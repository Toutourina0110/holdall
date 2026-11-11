import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { readStaged } from "@/core/plugins/install";
import { describePermission, isUnsafePermission, permissionRisk } from "@/core/plugins/permissions";
import { getEnv } from "@/core/env";
import { strings } from "@/core/strings";
import { Button, Chip, Notice } from "@/ui/controls";
import { PageHeader } from "@/ui/PageHeader";
import { Panel, PanelForm, PanelRow } from "@/ui/Panel";
import { cancelInstallAction, confirmInstallAction } from "../../actions";
import styles from "../../../admin/admin.module.css";
import consent from "./consent.module.css";

export const metadata: Metadata = { title: strings.plugins.consentTitle };

export default async function ConsentPage({ params }: { params: Promise<{ stageId: string }> }) {
  await requireAdmin();
  const { stageId } = await params;
  const t = strings.plugins;
  let staged;
  try {
    staged = readStaged(stageId);
  } catch (error) {
    return (
      <div className={styles.page}>
        <PageHeader title={t.consentTitle} />
        <Notice tone="warn">{error instanceof UserFacingError ? error.message : t.stageMissing}</Notice>
      </div>
    );
  }
  const { manifest, previous } = staged;
  const known = new Set(previous?.granted ?? []);
  const isNew = (permission: string) => Boolean(previous) && !known.has(permission);
  const unsafeAllowed = getEnv().allowUnsafePlugins;
  const all = [...manifest.permissions, ...manifest.optionalPermissions];
  const hasInterface = Boolean(manifest.entry.ui || manifest.contributes.page || manifest.contributes.widgets.length > 0);
  const readsData = all.some((permission) => /:read$/.test(permission) || permission === "storage");
  const riskChip = (permission: string) => {
    const risk = permissionRisk(permission);
    if (!risk) return null;
    return <Chip icon="alert">{risk === "unsafe" ? t.riskUnsafe : t.riskStrong}</Chip>;
  };
  return (
    <div className={styles.page}>
      <PageHeader title={`${t.consentTitle}: ${manifest.name}`} intro={manifest.description} />
      {staged.source === "third-party" && (
        <div className={consent.banner} role="alert">
          <strong>{t.thirdPartyBanner}</strong>
        </div>
      )}
      {all.some((permission) => isUnsafePermission(permission)) && <Notice tone="error">{t.unsafeNotice}</Notice>}
      {hasInterface && readsData && <Notice tone="warn">{t.interfaceNotice}</Notice>}
      <form>
        <input type="hidden" name="stageId" value={stageId} />
        <Panel title={t.aboutTitle}>
          <PanelRow>
            <span className={styles.meta}>{t.version}</span>
            <span className={styles.strong}>
              {manifest.version}
              {previous ? ` (${t.updatingFrom} ${previous.version})` : ""}
            </span>
          </PanelRow>
          <PanelRow>
            <span className={styles.meta}>{t.author}</span>
            <span className={styles.strong}>{manifest.author.name}</span>
            {manifest.author.url && <span className={styles.meta}>{manifest.author.url}</span>}
          </PanelRow>
          <PanelRow>
            <span className={styles.meta}>{t.checksum}</span>
            <code className={consent.code}>{staged.sha256}</code>
          </PanelRow>
        </Panel>
        <Panel title={t.permissionsTitle} count={`${manifest.permissions.length + manifest.optionalPermissions.length}`}>
          {manifest.permissions.length + manifest.optionalPermissions.length === 0 && <PanelRow>{t.noPermissions}</PanelRow>}
          {manifest.permissions.map((permission) => (
            <PanelRow key={permission}>
              <label className={consent.permission}>
                <input type="checkbox" checked readOnly disabled />
                <span>
                  <span className={styles.strong}>{describePermission(permission)}</span>
                  <span className={consent.id}>{permission}</span>
                </span>
              </label>
              {isNew(permission) && <Chip>{t.newPermission}</Chip>}
              {riskChip(permission)}
              <Chip>{t.required}</Chip>
            </PanelRow>
          ))}
          {manifest.optionalPermissions.map((permission) => (
            <PanelRow key={permission}>
              <label className={consent.permission}>
                <input
                  type="checkbox"
                  name="optional"
                  value={permission}
                  defaultChecked={!permissionRisk(permission)}
                  disabled={isUnsafePermission(permission) && !unsafeAllowed}
                />
                <span>
                  <span className={styles.strong}>{describePermission(permission)}</span>
                  <span className={consent.id}>{permission}</span>
                  {isUnsafePermission(permission) && !unsafeAllowed && <span className={consent.id}>{t.unsafeBlocked}</span>}
                </span>
              </label>
              {isNew(permission) && <Chip>{t.newPermission}</Chip>}
              {riskChip(permission)}
              <Chip>{t.optional}</Chip>
            </PanelRow>
          ))}
          {manifest.network.length > 0 && (
            <PanelRow>
              <span className={styles.grow}>
                <span className={styles.strong}>{t.domains}</span>
                <span className={consent.domains}>
                  {manifest.network.map((domain) => (
                    <code key={domain} className={consent.code}>
                      {domain}
                    </code>
                  ))}
                </span>
              </span>
            </PanelRow>
          )}
          <PanelForm>
            <p className={styles.help}>{t.requiredHelp}</p>
            <div className={consent.actions}>
              <Button variant="primary" icon="check" type="submit" formAction={confirmInstallAction}>
                {previous ? t.update : t.install}
              </Button>
              <Button type="submit" formAction={cancelInstallAction}>
                {t.cancel}
              </Button>
            </div>
          </PanelForm>
        </Panel>
      </form>
    </div>
  );
}
