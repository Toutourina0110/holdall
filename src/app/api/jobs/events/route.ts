import { apiSession, unauthorized } from "@/core/auth/session";
import { onJobUpdate } from "@/core/jobs/queue";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };
      send("retry: 3000\n\n");
      const unsubscribe = onJobUpdate(session.user.id, (row) => send(`data: ${JSON.stringify(row)}\n\n`));
      const ping = setInterval(() => send(": ping\n\n"), 25000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
