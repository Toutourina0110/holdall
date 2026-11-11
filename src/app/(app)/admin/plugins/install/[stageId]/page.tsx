import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { readStaged } from "@/core/plugins/install";
import { describePermission } from "@/core/plugins/permissions";
import { strings } from "@/core/strings";
import { Button, Chip, Notice } from "@/ui/controls";
import { PageHeader } from "@/ui/PageHeader";
import { Panel, PanelForm, PanelRow } from "@/ui/Panel";
import { cancelInstallAction, confirmInstallAction } from "../../actions";
import styles from "../../../admin.module.css";
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
  return (
    <div className={styles.page}>
      <PageHeader title={`${t.consentTitle}: ${manifest.name}`} intro={manifest.description} />
      {staged.source === "third-party" && (
        <div className={consent.banner} role="alert">
          <strong>{t.thirdPartyBanner}</strong>
        </div>
      )}
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
              <Chip>{t.required}</Chip>
            </PanelRow>
          ))}
          {manifest.optionalPermissions.map((permission) => (
            <PanelRow key={permission}>
              <label className={consent.permission}>
                <input type="checkbox" name="optional" value={permission} defaultChecked />
                <span>
                  <span className={styles.strong}>{describePermission(permission)}</span>
                  <span className={consent.id}>{permission}</span>
                </span>
              </label>
              {isNew(permission) && <Chip>{t.newPermission}</Chip>}
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
