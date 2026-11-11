import type { Metadata } from "next";
import { isRegistrationOpen, listInvitations, listUsers } from "@/core/auth/accounts";
import { requireAdmin } from "@/core/auth/session";
import { strings } from "@/core/strings";
import { ButtonLink } from "@/ui/controls";
import { PageHeader } from "@/ui/PageHeader";
import { InvitationsPanel, RegistrationPanel, UsersPanel } from "./AdminPanels";
import styles from "./admin.module.css";

export const metadata: Metadata = { title: strings.admin.title };

export default async function AdminPage() {
  const session = await requireAdmin();
  return (
    <div className={styles.page}>
      <PageHeader
        title={strings.admin.title}
        intro={strings.admin.intro}
        actions={
          <ButtonLink href="/admin/plugins" icon="plugins">
            {strings.plugins.manage}
          </ButtonLink>
        }
      />
      <UsersPanel users={listUsers()} currentUserId={session.user.id} />
      <InvitationsPanel invitations={listInvitations().map(({ id, role, expiresAt, usedAt }) => ({ id, role, expiresAt, usedAt }))} />
      <RegistrationPanel open={isRegistrationOpen()} />
    </div>
  );
}
