"use client";

import { useState, useTransition } from "react";
import { strings } from "@/core/strings";
import { Button, Chip, Notice, Segmented } from "@/ui/controls";
import { Panel, PanelEmpty, PanelForm, PanelRow } from "@/ui/Panel";
import { createInvitationAction, createResetLinkAction, revokeInvitationAction, setRegistrationAction, setRoleAction } from "./actions";
import styles from "./admin.module.css";

type UserRow = { id: string; name: string; email: string; role: string | null; createdAt: Date };
type InvitationRow = { id: string; role: string; expiresAt: Date; usedAt: Date | null };

function day(date: Date) {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function CopyLink({ link, label, warning }: { link: string; label: string; warning: string }) {
  const t = strings.admin;
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className={styles.linkBox}>
        <input className={styles.linkInput} readOnly value={link} aria-label={label} onFocus={(event) => event.target.select()} />
        <Button
          icon="copy"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? t.copied : t.copy}
        </Button>
      </div>
      <p className={styles.help}>{warning}</p>
    </>
  );
}

export function UsersPanel({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const t = strings.admin;
  const [error, setError] = useState<string>();
  const [reset, setReset] = useState<{ name: string; link: string }>();
  const [pending, start] = useTransition();
  return (
    <Panel title={t.usersTitle} count={`${users.length}`}>
      {(error || reset) && (
        <PanelForm>
          {error && <Notice tone="error">{error}</Notice>}
          {reset && <CopyLink key={reset.link} link={reset.link} label={t.resetFor.replace("{name}", reset.name)} warning={t.resetWarning} />}
        </PanelForm>
      )}
      {users.map((user) => (
        <PanelRow key={user.id}>
          <span className={styles.grow}>
            <span className={styles.strong}>{user.name}</span>
            {user.id === currentUserId && <span className={styles.meta}> ({t.you})</span>}
            <span className={styles.meta}> {user.email}</span>
          </span>
          <span className={styles.meta}>
            {t.joined} {day(user.createdAt)}
          </span>
          <Segmented
            label={`${t.roleFor} ${user.name}`}
            value={user.role === "admin" ? "admin" : "user"}
            onChange={(role) =>
              start(async () => {
                const result = await setRoleAction(user.id, role);
                setError(result.error);
              })
            }
            options={[
              { value: "user", label: strings.shell.roleUser },
              { value: "admin", label: strings.shell.roleAdmin },
            ]}
          />
          {user.id !== currentUserId && (
            <Button
              icon="reset"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await createResetLinkAction(user.id);
                  setError(result.error);
                  setReset(result.link ? { name: user.name, link: result.link } : undefined);
                })
              }
            >
              {t.resetPassword}
            </Button>
          )}
          {pending && <span className={styles.meta}>{t.saving}</span>}
        </PanelRow>
      ))}
    </Panel>
  );
}

export function InvitationsPanel({ invitations }: { invitations: InvitationRow[] }) {
  const t = strings.admin;
  const [role, setRole] = useState<"user" | "admin">("user");
  const [link, setLink] = useState<string>();
  const [pending, start] = useTransition();
  const open = invitations.filter((invitation) => !invitation.usedAt && new Date(invitation.expiresAt) > new Date());

  return (
    <Panel title={t.invitationsTitle} count={`${open.length} ${t.open}`}>
      <PanelForm>
        <p className={styles.help}>{t.invitationsHelp}</p>
        <Segmented label={t.inviteAs} value={role} onChange={setRole} options={[{ value: "user", label: strings.shell.roleUser }, { value: "admin", label: strings.shell.roleAdmin }]} />
        <Button
          variant="primary"
          icon="link"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await createInvitationAction(role);
              setLink(result.link);
            })
          }
        >
          {t.createLink}
        </Button>
        {link && <CopyLink link={link} label={t.linkLabel} warning={t.linkWarning} />}
      </PanelForm>
      {open.length === 0 && <PanelEmpty>{t.noInvitations}</PanelEmpty>}
      {open.map((invitation) => (
        <PanelRow key={invitation.id}>
          <span className={styles.grow}>
            <Chip>{invitation.role === "admin" ? strings.shell.roleAdmin : strings.shell.roleUser}</Chip>
            <span className={styles.meta}>
              {" "}
              {t.expires} {day(invitation.expiresAt)}
            </span>
          </span>
          <Button variant="danger" onClick={() => start(() => revokeInvitationAction(invitation.id))}>
            {t.revoke}
          </Button>
        </PanelRow>
      ))}
    </Panel>
  );
}

export function RegistrationPanel({ open }: { open: boolean }) {
  const t = strings.admin;
  const [pending, start] = useTransition();
  return (
    <Panel title={t.registrationTitle}>
      <PanelForm>
        <p className={styles.help}>{open ? t.registrationOpen : t.registrationClosed}</p>
        <Segmented
          label={t.registrationTitle}
          value={open ? "open" : "closed"}
          onChange={(value) => start(() => setRegistrationAction(value === "open"))}
          options={[
            { value: "closed", label: t.closed },
            { value: "open", label: t.openLabel },
          ]}
        />
        {pending && <span className={styles.meta}>{t.saving}</span>}
      </PanelForm>
    </Panel>
  );
}
