import type { ReactNode } from "react";
import { requireSession } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { slotItemsFor } from "@/core/layout/registry";
import { getUserLayout } from "@/core/layout/store";
import { unreadCount } from "@/core/notifications/store";
import "@/core/plugins/contributions";
import { filterDashboardWidgets } from "@/core/plugins/filters";
import "@/modules/register";
import { Shell } from "./shell/Shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const isAdmin = session.user.role === "admin";
  const items = await filterDashboardWidgets(slotItemsFor({ userId: session.user.id, isAdmin }), session.user.id);
  const layout = getUserLayout(session.user.id);
  return (
    <Shell user={{ name: session.user.name, email: session.user.email, role: session.user.role ?? "user" }} items={items} layout={layout} demo={getEnv().demoMode} unread={unreadCount(session.user.id)}>
      {children}
    </Shell>
  );
}
