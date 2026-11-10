import { apiSession, unauthorized } from "@/core/auth/session";
import { listInstalledPlugins, isPluginEnabledFor } from "@/core/plugins/store";

export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const plugins = listInstalledPlugins().map((item) => ({
    id: item.id,
    name: item.manifest.name,
    version: item.version,
    source: item.source,
    enabled: isPluginEnabledFor(session.user.id, item.id),
  }));
  return Response.json({ plugins });
}
