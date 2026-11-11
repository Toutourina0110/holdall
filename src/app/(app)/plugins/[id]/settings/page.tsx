import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/core/auth/session";
import { readSettings, settingFields } from "@/core/plugins/settings";
import { getInstalledPlugin, isPluginEnabledFor } from "@/core/plugins/store";
import { strings } from "@/core/strings";
import { PageHeader } from "@/ui/PageHeader";
import { SettingsForm } from "./SettingsForm";
import styles from "../../../admin/admin.module.css";

export const metadata: Metadata = { title: strings.pluginSettings.title };

export default async function PluginSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const installed = getInstalledPlugin(id);
  if (!installed) notFound();
  const isAdmin = session.user.role === "admin";
  const enabled = isPluginEnabledFor(session.user.id, id);
  const fields = settingFields(id);
  const personal = enabled ? fields.filter((field) => field.scope === "personal") : [];
  const global = isAdmin ? fields.filter((field) => field.scope === "global") : [];
  if (personal.length === 0 && global.length === 0) notFound();
  const values = readSettings(id, session.user.id, { secrets: "hidden" });
  const t = strings.pluginSettings;
  return (
    <div className={styles.page}>
      <PageHeader title={`${installed.manifest.name}: ${t.title}`} intro={installed.manifest.description} />
      {personal.length > 0 && <SettingsForm pluginId={id} scope="personal" title={t.personal} help={t.personalHelp} fields={personal} values={values} />}
      {global.length > 0 && <SettingsForm pluginId={id} scope="global" title={t.global} help={t.globalHelp} fields={global} values={values} />}
    </div>
  );
}
