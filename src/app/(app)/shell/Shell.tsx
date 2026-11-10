"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { ResolvedItem, SlotItem } from "@/core/layout/registry";
import type { UserLayout } from "@/core/layout/schema";
import { strings } from "@/core/strings";
import { Button } from "@/ui/controls";
import { Icon, type IconName } from "@/ui/Icon";
import { SurveyMark } from "@/ui/SurveyMark";
import { signOutAction } from "../actions";
import { CustomizeProvider, useCustomize } from "./CustomizeContext";
import { itemStyle, SlotList } from "./SlotList";
import { StylePanel } from "./StylePanel";
import styles from "./shell.module.css";

type ShellUser = { name: string; email: string; role: string };

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function RailLink({ item }: { item: ResolvedItem }) {
  const pathname = usePathname();
  const customize = useCustomize();
  const label = item.style.label || item.label;
  const icon = (item.style.icon as IconName | undefined) ?? item.icon;
  const content = (
    <>
      <span className={styles.railTile}>
        <Icon name={icon} />
      </span>
      <span className={styles.railLabel}>{label}</span>
    </>
  );
  const common = {
    className: styles.railItem,
    style: itemStyle(item),
    "data-size": item.style.size,
    "data-spacing": item.style.spacing,
    "data-radius": item.style.radius,
  };
  if (customize.customizing || !item.href) return <span {...common}>{content}</span>;
  return (
    <Link {...common} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
      {content}
    </Link>
  );
}

function Rail({ user }: { user: ShellUser }) {
  const t = strings.shell;
  const customize = useCustomize();
  return (
    <nav className={styles.rail} aria-label={t.navigation}>
      <Link className={styles.brand} href="/">
        <span className={styles.brandMark}>
          <SurveyMark state="done" size={16} />
        </span>
        {strings.app.name}
      </Link>
      <SlotList slot="rail.main" className={styles.railList} render={(item) => <RailLink item={item} />} />
      {customize.slot("rail.media").length > 0 && <p className={styles.group}>{t.groupMedia}</p>}
      <SlotList slot="rail.media" className={styles.railList} render={(item) => <RailLink item={item} />} />
      <p className={styles.group}>{t.groupSystem}</p>
      <SlotList slot="rail.system" className={styles.railList} render={(item) => <RailLink item={item} />} />
      <div className={styles.me}>
        <span className={styles.avatar} aria-hidden="true">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className={styles.who}>
          {user.name}
          <small>{user.role === "admin" ? t.roleAdmin : t.roleUser}</small>
        </span>
        <form action={signOutAction}>
          <button className={styles.meButton} type="submit" aria-label={strings.auth.signOut} title={strings.auth.signOut}>
            <Icon name="logout" />
          </button>
        </form>
      </div>
    </nav>
  );
}

function TopBar() {
  const t = strings.shell;
  const customize = useCustomize();
  const pathname = usePathname();
  const all = [...customize.slot("rail.main"), ...customize.slot("rail.media"), ...customize.slot("rail.system")];
  const current = all.filter((item) => isActive(pathname, item.href)).sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];
  return (
    <header className={styles.top}>
      <span className={styles.crumb}>
        <span className={styles.crumbTile}>
          <Icon name={current?.icon ?? "today"} size={14} />
        </span>
        {strings.app.name}
        <span aria-hidden="true">/</span>
        <b>{current?.style.label || current?.label || t.untitled}</b>
      </span>
      <div className={styles.topRight}>
        {!customize.customizing && (
          <Button icon="layout" onClick={customize.start}>
            {t.customize}
          </Button>
        )}
      </div>
    </header>
  );
}

function CustomizeBar() {
  const t = strings.shell;
  const customize = useCustomize();
  if (!customize.customizing) return null;
  return (
    <div className={styles.customizeBar} role="region" aria-label={t.customizeRegion}>
      <p>{customize.error ?? t.customizeHelp}</p>
      <div className={styles.customizeActions}>
        <Button icon="reset" onClick={customize.resetAll} disabled={customize.saving}>
          {t.resetAll}
        </Button>
        <Button onClick={customize.cancel} disabled={customize.saving}>
          {t.cancel}
        </Button>
        <Button variant="primary" icon="check" onClick={customize.save} disabled={customize.saving}>
          {t.save}
        </Button>
      </div>
    </div>
  );
}

function BottomBar() {
  const customize = useCustomize();
  const pathname = usePathname();
  const items = [...customize.slot("rail.main"), ...customize.slot("rail.media"), ...customize.slot("rail.system")]
    .filter((item) => !item.hidden && item.href)
    .slice(0, 5);
  return (
    <nav className={styles.bottomBar} aria-label={strings.shell.navigation}>
      {items.map((item) => (
        <Link key={item.id} href={item.href!} className={styles.bottomItem} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
          <Icon name={(item.style.icon as IconName | undefined) ?? item.icon} size={20} />
          <span>{item.style.label || item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function Shell({ user, items, layout, children }: { user: ShellUser; items: SlotItem[]; layout: UserLayout; children: ReactNode }) {
  return (
    <CustomizeProvider items={items} layout={layout}>
      <div className={styles.shell}>
        <Rail user={user} />
        <div className={styles.page}>
          <TopBar />
          <main className={styles.main} id="main">
            {children}
          </main>
        </div>
        <StylePanel />
        <CustomizeBar />
        <BottomBar />
      </div>
    </CustomizeProvider>
  );
}
