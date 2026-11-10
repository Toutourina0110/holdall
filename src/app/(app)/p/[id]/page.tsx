import { notFound } from "next/navigation";
import { requireSession } from "@/core/auth/session";
import { getInstalledPlugin, isPluginEnabledFor } from "@/core/plugins/store";
import { PageHeader } from "@/ui/PageHeader";
import { PluginFrame } from "@/ui/PluginFrame";

export default async function PluginPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const installed = getInstalledPlugin(id);
  const page = installed?.manifest.contributes.page;
  if (!installed || !page || !installed.granted.has("ui:slots") || !isPluginEnabledFor(session.user.id, id)) notFound();
  return (
    <>
      <PageHeader title={page.title} intro={installed.manifest.description} />
      <PluginFrame pluginId={id} entry={page.entry} title={page.title} tall />
    </>
  );
}
