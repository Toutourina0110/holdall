import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/core/db/client";
import { job } from "@/core/db/schema";
import { createLogger } from "@/core/log";

export type JobRow = typeof job.$inferSelect;
export type JobRecord = Omit<JobRow, "payload"> & { payload: unknown };

export type JobContext = {
  signal: AbortSignal;
  progress(value: number, message?: string): void;
};

export type JobHandler = (job: JobRecord, context: JobContext) => Promise<unknown>;

type WorkerState = {
  handlers: Map<string, JobHandler>;
  running: Map<string, AbortController>;
  events: EventEmitter;
  timer?: ReturnType<typeof setInterval>;
  concurrency: number;
  ticking: boolean;
};

const globalKey = Symbol.for("holdall.jobs");
const store = globalThis as unknown as Record<symbol, WorkerState | undefined>;
const state: WorkerState = (store[globalKey] ??= {
  handlers: new Map(),
  running: new Map(),
  events: new EventEmitter().setMaxListeners(0),
  concurrency: 2,
  ticking: false,
});

const log = createLogger("jobs");

function emit(userId: string, id: string) {
  const row = getDb().select().from(job).where(eq(job.id, id)).get();
  if (row) state.events.emit(`user:${userId}`, row);
}

export function onJobUpdate(userId: string, listener: (row: JobRow) => void): () => void {
  state.events.on(`user:${userId}`, listener);
  return () => state.events.off(`user:${userId}`, listener);
}

export function registerJobHandler(type: string, handler: JobHandler): void {
  state.handlers.set(type, handler);
}

export function enqueueJob(input: { userId: string; type: string; payload: unknown; maxAttempts?: number }): string {
  const id = randomUUID();
  getDb()
    .insert(job)
    .values({
      id,
      userId: input.userId,
      type: input.type,
      payload: JSON.stringify(input.payload ?? {}),
      status: "queued",
      maxAttempts: input.maxAttempts ?? 3,
    })
    .run();
  emit(input.userId, id);
  setImmediate(() => void tick());
  return id;
}

export function getJob(userId: string, id: string): JobRow | undefined {
  return getDb().select().from(job).where(and(eq(job.id, id), eq(job.userId, userId))).get();
}

export function listJobs(userId: string, type?: string): JobRow[] {
  const where = type ? and(eq(job.userId, userId), eq(job.type, type)) : eq(job.userId, userId);
  return getDb().select().from(job).where(where).orderBy(desc(job.createdAt)).limit(200).all();
}

export function cancelJob(userId: string, id: string): boolean {
  const row = getJob(userId, id);
  if (!row || (row.status !== "queued" && row.status !== "running")) return false;
  const controller = state.running.get(id);
  if (controller) controller.abort();
  getDb().update(job).set({ status: "cancelled", finishedAt: new Date() }).where(eq(job.id, id)).run();
  emit(userId, id);
  return true;
}

export function retryJob(userId: string, id: string): boolean {
  const row = getJob(userId, id);
  if (!row || (row.status !== "failed" && row.status !== "cancelled")) return false;
  getDb()
    .update(job)
    .set({ status: "queued", attempts: 0, error: null, progress: 0, message: null, finishedAt: null })
    .where(eq(job.id, id))
    .run();
  emit(userId, id);
  setImmediate(() => void tick());
  return true;
}

export function recoverInterruptedJobs(): number {
  const result = getDb().update(job).set({ status: "queued", startedAt: null }).where(eq(job.status, "running")).run();
  return result.changes;
}

export function markRunningForTest(id: string): void {
  getDb().update(job).set({ status: "running" }).where(eq(job.id, id)).run();
}

async function run(row: JobRow, handler: JobHandler) {
  const controller = new AbortController();
  state.running.set(row.id, controller);
  const db = getDb();
  const context: JobContext = {
    signal: controller.signal,
    progress(value, message) {
      if (controller.signal.aborted) return;
      db.update(job)
        .set({ progress: Math.max(0, Math.min(1, value)), message: message ?? null })
        .where(and(eq(job.id, row.id), eq(job.status, "running")))
        .run();
      emit(row.userId, row.id);
    },
  };
  try {
    const result = await handler({ ...row, payload: JSON.parse(row.payload) as unknown }, context);
    if (controller.signal.aborted) return;
    db.update(job)
      .set({ status: "done", progress: 1, result: JSON.stringify(result ?? null), finishedAt: new Date() })
      .where(and(eq(job.id, row.id), eq(job.status, "running")))
      .run();
  } catch (error) {
    if (controller.signal.aborted) return;
    const message = error instanceof Error ? error.message : String(error);
    const attempts = row.attempts + 1;
    const retry = attempts < row.maxAttempts;
    db.update(job)
      .set(
        retry
          ? { status: "queued", attempts, error: message, startedAt: null }
          : { status: "failed", attempts, error: message, finishedAt: new Date() },
      )
      .where(and(eq(job.id, row.id), eq(job.status, "running")))
      .run();
    log.warn("Job failed", { id: row.id, type: row.type, attempts, retry });
  } finally {
    state.running.delete(row.id);
    emit(row.userId, row.id);
    setImmediate(() => void tick());
  }
}

async function tick() {
  if (state.ticking || !state.timer) return;
  state.ticking = true;
  try {
    const free = state.concurrency - state.running.size;
    if (free <= 0) return;
    const types = [...state.handlers.keys()];
    if (types.length === 0) return;
    const db = getDb();
    const candidates = db
      .select()
      .from(job)
      .where(and(eq(job.status, "queued"), inArray(job.type, types)))
      .orderBy(asc(job.createdAt))
      .limit(free)
      .all();
    for (const candidate of candidates) {
      const claimed = db
        .update(job)
        .set({ status: "running", startedAt: new Date() })
        .where(and(eq(job.id, candidate.id), eq(job.status, "queued")))
        .run();
      if (claimed.changes === 0) continue;
      const handler = state.handlers.get(candidate.type)!;
      void run({ ...candidate, status: "running" }, handler);
    }
  } catch (error) {
    log.warn("Could not read the job queue", { error: String(error) });
  } finally {
    state.ticking = false;
  }
}

export function startJobWorker(options: { concurrency: number; pollMs?: number }): void {
  state.concurrency = options.concurrency;
  if (state.timer) return;
  const recovered = recoverInterruptedJobs();
  if (recovered > 0) log.info("Resumed interrupted jobs", { count: recovered });
  state.timer = setInterval(() => void tick(), options.pollMs ?? 1000);
  state.timer.unref?.();
  void tick();
}

export function stopJobWorker(): void {
  if (state.timer) clearInterval(state.timer);
  state.timer = undefined;
  for (const controller of state.running.values()) controller.abort();
}

export function deleteJob(userId: string, id: string): boolean {
  const row = getJob(userId, id);
  if (!row || row.status === "running") return false;
  getDb().delete(job).where(and(eq(job.id, id), eq(job.userId, userId))).run();
  return true;
}
