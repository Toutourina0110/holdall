import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/session";
import { describePermission } from "@/core/plugins/permissions";
import { listInstalledPlugins } from "@/core/plugins/store";
import { strings } from "@/core/strings";
import { PageHeader } from "@/ui/PageHeader";
import { InstalledPanel, InstallPanel } from "./PluginAdmin";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: strings.plugins.adminTitle };

export default async function AdminPluginsPage() {
  await requireAdmin();
  const plugins = listInstalledPlugins().map((item) => ({
    id: item.id,
    name: item.manifest.name,
    version: item.version,
    author: item.manifest.author.name,
    source: item.source,
    description: item.manifest.description,
    required: item.manifest.permissions.map((permission) => ({ permission, label: describePermission(permission) })),
    optional: item.manifest.optionalPermissions.map((permission) => ({
      permission,
      label: describePermission(permission),
      granted: item.granted.has(permission),
    })),
  }));
  return (
    <div className={styles.page}>
      <PageHeader title={strings.plugins.adminTitle} intro={strings.plugins.adminIntro} />
      <InstallPanel />
      <InstalledPanel plugins={plugins} />
    </div>
  );
}
