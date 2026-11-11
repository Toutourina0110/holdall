import { z } from "zod";
import { apiSession, unauthorized } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { callPluginFunction, PluginCallError } from "@/core/plugins/host";
import { getInstalledPlugin, isPluginEnabledFor } from "@/core/plugins/store";

const body = z.object({ name: z.string().regex(/^[A-Za-z0-9_.:-]{1,80}$/), args: z.unknown() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(getEnv().appUrl).origin) return Response.json({ error: "Cross-origin calls are not allowed." }, { status: 403 });
  const { id } = await params;
  const installed = getInstalledPlugin(id);
  if (!installed?.manifest.entry.server || !isPluginEnabledFor(session.user.id, id)) {
    return Response.json({ error: "This plugin is not available for your account." }, { status: 404 });
  }
  const text = await request.text();
  if (text.length > 1024 * 1024) return Response.json({ error: "The call is larger than 1 MB." }, { status: 413 });
  let parsed;
  try {
    parsed = body.safeParse(JSON.parse(text));
  } catch {
    return Response.json({ error: "Send a name and args." }, { status: 400 });
  }
  if (!parsed.success) return Response.json({ error: "Send a name and args." }, { status: 400 });
  try {
    return Response.json({ result: (await callPluginFunction(id, parsed.data.name, parsed.data.args ?? null, session.user.id)) ?? null });
  } catch (error) {
    if (error instanceof PluginCallError) return Response.json({ error: error.message }, { status: 422 });
    return Response.json({ error: "The plugin could not answer. Try again." }, { status: 500 });
  }
}
