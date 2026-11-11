import { apiSession, unauthorized } from "@/core/auth/session";
import { signAssetToken } from "@/core/plugins/asset-token";
import { isPluginEnabledFor } from "@/core/plugins/store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const { id } = await params;
  if (!isPluginEnabledFor(session.user.id, id)) return Response.json({ error: "This plugin is not available for your account." }, { status: 404 });
  return Response.json({ token: signAssetToken(id, session.user.id) }, { headers: { "Cache-Control": "no-store" } });
}
