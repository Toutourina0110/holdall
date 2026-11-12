import { z, ZodError } from "zod";
import { UserFacingError } from "@/core/errors";
import { apiSession, unauthorized } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { callPluginApi, PluginPermissionError } from "@/core/plugins/api";
import { readLimitedText } from "@/core/security/read-body";

const body = z.object({ method: z.string().max(80), params: z.unknown() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(getEnv().appUrl).origin) return Response.json({ error: "Cross-origin calls are not allowed." }, { status: 403 });
  const text = await readLimitedText(request, 24 * 1024 * 1024);
  if (text === undefined) return Response.json({ error: "The call is larger than 24 MB." }, { status: 413 });
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Send a method and params." }, { status: 400 });
  try {
    const result = await callPluginApi(parsed.data.method, parsed.data.params, { pluginId: (await params).id, userId: session.user.id });
    return Response.json({ result });
  } catch (error) {
    if (error instanceof PluginPermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof UserFacingError) return Response.json({ error: error.message }, { status: 422 });
    if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Check the parameters." }, { status: 400 });
    return Response.json({ error: "The plugin call failed." }, { status: 500 });
  }
}
