import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { countUsers } from "@/core/auth/accounts";
import { strings } from "@/core/strings";
import { AccountForm } from "../AccountForm";
import { setupAction } from "../actions";
import { AuthPanel } from "../AuthPanel";

export const metadata: Metadata = { title: strings.auth.setupTitle };

export default function SetupPage() {
  if (countUsers() > 0) redirect("/login");
  const t = strings.auth;
  return (
    <AuthPanel crumb={t.setupTitle} title={t.setupTitle} intro={t.setupIntro}>
      <AccountForm action={setupAction} submitLabel={t.setupSubmit} />
    </AuthPanel>
  );
}
