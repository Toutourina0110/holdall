import type { Metadata } from "next";
import { requireSession } from "@/core/auth/session";
import { strings } from "@/core/strings";
import { PageHeader } from "@/ui/PageHeader";
import { targetsFor } from "@/modules/converter/formats";
import { allFiles, roots } from "@/modules/files/store";
import { ConverterBoard } from "./ConverterBoard";
import styles from "./converter.module.css";

export const metadata: Metadata = { title: strings.converter.title };

export default async function ConverterPage() {
  const session = await requireSession();
  const candidates = roots.flatMap((root) =>
    allFiles(session.user.id, root)
      .map((path) => ({ root, path, targets: targetsFor(path) }))
      .filter((item) => item.targets.length > 0),
  );
  return (
    <div className={styles.page}>
      <PageHeader title={strings.converter.title} intro={strings.converter.intro} />
      <ConverterBoard candidates={candidates} />
    </div>
  );
}
