import type { ReactNode } from "react";
import { strings } from "@/core/strings";
import { PageHeader } from "@/ui/PageHeader";
import { SettingsTabs } from "./SettingsTabs";
import styles from "./settings.module.css";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <PageHeader title={strings.settings.title} intro={strings.settings.intro} />
      <SettingsTabs />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
