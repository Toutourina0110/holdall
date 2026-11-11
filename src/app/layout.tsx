import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getSession } from "@/core/auth/session";
import { strings } from "@/core/strings";
import { getUserTheme, themeToCss, type UserThemeChoice } from "@/core/theme/store";
import "./tokens.css";
import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: strings.app.name, template: `%s | ${strings.app.name}` },
  description: strings.app.description,
};

async function themeChoice(): Promise<UserThemeChoice> {
  try {
    const session = await getSession();
    return session ? getUserTheme(session.user.id) : { mode: "system" };
  } catch {
    return { mode: "system" };
  }
}

function dataTheme(choice: UserThemeChoice): string | undefined {
  if (choice.mode === "light" || choice.mode === "dark") return choice.mode;
  if (choice.mode === "custom" && choice.theme) return choice.theme.base;
  return undefined;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const choice = await themeChoice();
  return (
    <html lang="en" className={plex.variable} data-theme={dataTheme(choice)}>
      <head>
        {choice.mode === "custom" && choice.theme && (
          <style nonce={nonce} id="holdall-theme" dangerouslySetInnerHTML={{ __html: themeToCss(choice.theme) }} />
        )}
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
