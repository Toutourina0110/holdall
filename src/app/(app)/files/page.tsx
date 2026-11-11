import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { strings } from "@/core/strings";
import { Notice } from "@/ui/controls";
import { PageHeader } from "@/ui/PageHeader";
import { targetsFor } from "@/modules/converter/formats";
import { allFolders, listFolder, roots, type Root } from "@/modules/files/store";
import { FileBrowser } from "./FileBrowser";
import styles from "./files.module.css";

export const metadata: Metadata = { title: strings.files.title };

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ root?: string; path?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  const t = strings.files;
  const root: Root = params.root === "downloads" ? "downloads" : "files";
  const path = params.path ?? "";
  let data: { entries: Parameters<typeof FileBrowser>[0]["entries"]; folders: string[] } | undefined;
  let problem: string | undefined;
  try {
    const entries = listFolder(session.user.id, root, path).map((entry) => ({ ...entry, targets: entry.kind === "file" ? targetsFor(entry.name) : [] }));
    data = { entries, folders: allFolders(session.user.id, root) };
  } catch (error) {
    problem = error instanceof UserFacingError ? error.message : t.loadFailed;
  }
  return (
    <div className={styles.page}>
      <PageHeader title={t.title} />
      <nav className={styles.roots} aria-label={t.title}>
        {roots.map((item) => (
          <Link key={item} href={`/files?root=${item}`} aria-current={item === root ? "page" : undefined}>
            {item === "files" ? t.myFiles : t.downloads}
          </Link>
        ))}
      </nav>
      {data ? <FileBrowser root={root} path={path} entries={data.entries} folders={data.folders} /> : <Notice tone="error">{problem}</Notice>}
    </div>
  );
}
