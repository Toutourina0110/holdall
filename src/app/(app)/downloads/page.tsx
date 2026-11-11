import type { Metadata } from "next";
import { requireSession } from "@/core/auth/session";
import { strings } from "@/core/strings";
import { PageHeader } from "@/ui/PageHeader";
import { canManageTools, ffmpegPath, toolVersion, ytdlpPath } from "@/modules/downloader/tools";
import { DownloadsBoard } from "./DownloadsBoard";
import { ToolsPanel } from "./ToolsPanel";
import styles from "./downloads.module.css";

export const metadata: Metadata = { title: strings.downloads.title };

function ffmpegLabel(): string | undefined {
  const line = toolVersion(ffmpegPath(), ["-version"]);
  return line?.replace(/^ffmpeg version\s+/, "").split(" ")[0];
}

export default async function DownloadsPage() {
  const session = await requireSession();
  const isAdmin = session.user.role === "admin";
  return (
    <div className={styles.page}>
      <PageHeader title={strings.downloads.title} />
      <DownloadsBoard />
      {isAdmin && <ToolsPanel ytdlp={toolVersion(ytdlpPath(), ["--version"])} ffmpeg={ffmpegLabel()} managed={canManageTools()} />}
    </div>
  );
}
