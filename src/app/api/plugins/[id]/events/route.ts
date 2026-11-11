import { apiSession, unauthorized } from "@/core/auth/session";
import { onPluginEvent } from "@/core/plugins/live";
import { isPluginEnabledFor } from "@/core/plugins/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const { id } = await params;
  if (!isPluginEnabledFor(session.user.id, id)) return Response.json({ error: "This plugin is not available for your account." }, { status: 404 });
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
      const unsubscribe = onPluginEvent(id, session.user.id, (message) => send(`data: ${JSON.stringify(message)}\n\n`));
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
