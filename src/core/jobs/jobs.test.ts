import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertUser, useTempDatabase } from "@/test/db";

let db: Awaited<ReturnType<typeof useTempDatabase>>;
let jobs: typeof import("./queue");

beforeAll(async () => {
  db = await useTempDatabase("jobs");
  await insertUser("alice");
  await insertUser("bob");
  jobs = await import("./queue");
});

afterAll(async () => {
  jobs.stopJobWorker();
  await db.cleanup();
});

function waitFor(check: () => boolean, timeout = 3000) {
  return new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeout) {
        clearInterval(timer);
        reject(new Error("Timed out"));
      }
    }, 10);
  });
}

describe("job queue", () => {
  it("puts jobs that were running before a restart back in the queue", () => {
    const id = jobs.enqueueJob({ userId: "alice", type: "test.never", payload: {} });
    jobs.markRunningForTest(id);
    expect(jobs.recoverInterruptedJobs()).toBe(1);
    expect(jobs.getJob("alice", id)?.status).toBe("queued");
  });

  it("runs a job, reports progress and stores the result", async () => {
    jobs.registerJobHandler("test.ok", async (job, context) => {
      context.progress(0.5, "half");
      return { echoed: (job.payload as { value: number }).value };
    });
    jobs.startJobWorker({ concurrency: 2, pollMs: 10 });
    const id = jobs.enqueueJob({ userId: "alice", type: "test.ok", payload: { value: 7 } });
    await waitFor(() => jobs.getJob("alice", id)?.status === "done");
    const job = jobs.getJob("alice", id)!;
    expect(job.progress).toBe(1);
    expect(JSON.parse(job.result!)).toEqual({ echoed: 7 });
  });

  it("retries a failing job, then marks it failed", async () => {
    let calls = 0;
    jobs.registerJobHandler("test.fail", async () => {
      calls += 1;
      throw new Error("boom");
    });
    const id = jobs.enqueueJob({ userId: "alice", type: "test.fail", payload: {}, maxAttempts: 2 });
    await waitFor(() => jobs.getJob("alice", id)?.status === "failed");
    expect(calls).toBe(2);
    expect(jobs.getJob("alice", id)?.error).toBe("boom");
    expect(jobs.retryJob("alice", id)).toBe(true);
    expect(jobs.getJob("alice", id)?.status).toBe("queued");
  });

  it("cancels a running job through its abort signal", async () => {
    jobs.registerJobHandler("test.slow", (_job, context) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 5000);
        context.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("aborted"));
        });
      });
    });
    const id = jobs.enqueueJob({ userId: "alice", type: "test.slow", payload: {} });
    await waitFor(() => jobs.getJob("alice", id)?.status === "running");
    expect(jobs.cancelJob("alice", id)).toBe(true);
    await waitFor(() => jobs.getJob("alice", id)?.status === "cancelled");
  });

  it("never lets one user see, cancel or retry another user's job", async () => {
    const id = jobs.enqueueJob({ userId: "alice", type: "test.never", payload: {} });
    expect(jobs.getJob("bob", id)).toBeUndefined();
    expect(jobs.listJobs("bob").some((job) => job.id === id)).toBe(false);
    expect(jobs.cancelJob("bob", id)).toBe(false);
    expect(jobs.getJob("alice", id)?.status).toBe("queued");
    expect(jobs.retryJob("bob", id)).toBe(false);
  });
});
