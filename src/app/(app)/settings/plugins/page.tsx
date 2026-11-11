import type { Metadata } from "next";
import { requireSession } from "@/core/auth/session";
import { describePermission } from "@/core/plugins/permissions";
import { isPluginEnabledFor, listInstalledPlugins } from "@/core/plugins/store";
import { strings } from "@/core/strings";
import { ButtonLink } from "@/ui/controls";
import { PluginToggles } from "./PluginToggles";
import styles from "../settings.module.css";

export const metadata: Metadata = { title: strings.settings.tabPlugins };

export default async function PluginSettingsPage() {
  const session = await requireSession();
  const isAdmin = session.user.role === "admin";
  const plugins = listInstalledPlugins().map((item) => ({
    id: item.id,
    name: item.manifest.name,
    version: item.version,
    author: item.manifest.author.name,
    description: item.manifest.description,
    source: item.source,
    enabled: isPluginEnabledFor(session.user.id, item.id),
    permissions: [...item.granted].map(describePermission),
  }));
  return (
    <>
      {isAdmin && (
        <div className={styles.toolbar}>
          <ButtonLink href="/admin/plugins" icon="admin">
            {strings.plugins.manage}
          </ButtonLink>
        </div>
      )}
      <PluginToggles plugins={plugins} isAdmin={isAdmin} />
    </>
  );
}
