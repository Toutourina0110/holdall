import type { ReactNode } from "react";
import { requireSession } from "@/core/auth/session";
import { slotItemsFor } from "@/core/layout/registry";
import { getUserLayout } from "@/core/layout/store";
import "@/core/plugins/contributions";
import "@/modules/register";
import { Shell } from "./shell/Shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const isAdmin = session.user.role === "admin";
  const items = slotItemsFor({ userId: session.user.id, isAdmin });
  const layout = getUserLayout(session.user.id);
  return (
    <Shell user={{ name: session.user.name, email: session.user.email, role: session.user.role ?? "user" }} items={items} layout={layout}>
      {children}
    </Shell>
  );
}
