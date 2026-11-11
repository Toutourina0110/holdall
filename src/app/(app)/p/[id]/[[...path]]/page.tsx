import { notFound } from "next/navigation";
import { requireSession } from "@/core/auth/session";
import { getInstalledPlugin, isPluginEnabledFor } from "@/core/plugins/store";
import { PageHeader } from "@/ui/PageHeader";
import { PluginFrame } from "@/ui/PluginFrame";

export default async function PluginPage({ params }: { params: Promise<{ id: string; path?: string[] }> }) {
  const session = await requireSession();
  const { id, path = [] } = await params;
  const installed = getInstalledPlugin(id);
  const page = installed?.manifest.contributes.page;
  if (!installed || !page || !installed.granted.has("ui:slots") || !isPluginEnabledFor(session.user.id, id)) notFound();
  const current = path.join("/");
  if (current.length > 300 || !/^[A-Za-z0-9._~/-]*$/.test(current)) notFound();
  const sub = page.pages.find((item) => item.path === current);
  return (
    <>
      <PageHeader title={sub ? `${page.title}: ${sub.title}` : page.title} intro={installed.manifest.description} />
      <PluginFrame pluginId={id} entry={page.entry} title={page.title} tall path={current} />
    </>
  );
}
