"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { strings } from "@/core/strings";
import styles from "./settings.module.css";

export function SettingsTabs() {
  const pathname = usePathname();
  const t = strings.settings;
  const tabs = [
    { href: "/settings", label: t.tabAccount },
    { href: "/settings/appearance", label: t.tabAppearance },
    { href: "/settings/layout", label: t.tabLayout },
    { href: "/settings/plugins", label: t.tabPlugins },
  ];
  return (
    <nav className={styles.tabs} aria-label={t.title}>
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={styles.tab} aria-current={pathname === tab.href ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
