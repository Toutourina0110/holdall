import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { satisfies } from "@/core/plugins/manifest";
import { describePermission } from "@/core/plugins/permissions";
import { loadRegistry } from "@/core/plugins/registry";
import { listInstalledPlugins } from "@/core/plugins/store";
import { strings } from "@/core/strings";
import { PageHeader } from "@/ui/PageHeader";
import { InstalledPanel, InstallPanel, StorePanel, type StoreRow } from "./PluginAdmin";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: strings.plugins.adminTitle };

async function StoreSection({ installed }: { installed: Map<string, string> }) {
  let store: StoreRow[] = [];
  let storeError: string | undefined;
  try {
    store = (await loadRegistry()).map((entry) => {
      const current = installed.get(entry.id);
      return {
        id: entry.id,
        name: entry.name,
        version: entry.version,
        type: entry.type,
        author: entry.author.name,
        description: entry.description,
        source: entry.source,
        state: !current ? "new" : satisfies(current, `>=${entry.version}`) ? "installed" : "update",
      };
    });
  } catch (error) {
    storeError = error instanceof UserFacingError ? error.message : strings.plugins.storeError;
  }
  return <StorePanel entries={store} error={storeError} />;
}

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
      <Suspense fallback={<StorePanel entries={[]} loading />}>
        <StoreSection installed={new Map(plugins.map((item) => [item.id, item.version]))} />
      </Suspense>
      <InstallPanel />
      <InstalledPanel plugins={plugins} />
    </div>
  );
}
