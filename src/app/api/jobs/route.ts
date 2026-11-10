import { apiSession, unauthorized } from "@/core/auth/session";
import { listJobs } from "@/core/jobs/queue";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const type = new URL(request.url).searchParams.get("type") ?? undefined;
  return Response.json({ jobs: listJobs(session.user.id, type) });
}
