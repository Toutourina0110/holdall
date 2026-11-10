import { z } from "zod";
import { apiSession, unauthorized } from "@/core/auth/session";
import { cancelJob, getJob, retryJob } from "@/core/jobs/queue";

const body = z.object({ action: z.enum(["cancel", "retry"]) });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const job = getJob(session.user.id, (await params).id);
  if (!job) return Response.json({ error: "This job does not exist." }, { status: 404 });
  return Response.json({ job });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send an action: cancel or retry." }, { status: 400 });
  const { id } = await params;
  const done = parsed.data.action === "cancel" ? cancelJob(session.user.id, id) : retryJob(session.user.id, id);
  if (!done) return Response.json({ error: "This job cannot be changed now." }, { status: 409 });
  return Response.json({ job: getJob(session.user.id, id) });
}
