"use client";

import { useState, useTransition } from "react";
import { strings } from "@/core/strings";
import { Button, Notice } from "@/ui/controls";
import { Panel, PanelForm, PanelRow } from "@/ui/Panel";
import { useJobs } from "@/ui/useJobs";
import { updateToolsAction } from "./actions";
import styles from "./downloads.module.css";

export function ToolsPanel({ ytdlp, ffmpeg, managed }: { ytdlp?: string; ffmpeg?: string; managed: boolean }) {
  const t = strings.downloads;
  const [jobId, setJobId] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const { jobs } = useJobs("downloader.tools");
  const job = jobs?.find((item) => item.id === jobId);
  return (
    <Panel title={t.toolsTitle}>
      <PanelRow>
        <span className={styles.grow}>yt-dlp</span>
        <span className={styles.meta}>{ytdlp ?? t.notInstalled}</span>
      </PanelRow>
      <PanelRow>
        <span className={styles.grow}>ffmpeg</span>
        <span className={styles.meta}>{ffmpeg ?? t.notInstalled}</span>
      </PanelRow>
      <PanelForm>
        <p className={styles.meta}>{managed ? t.toolsHelp : t.toolsDocker}</p>
        {error && <Notice tone="error">{error}</Notice>}
        {job?.status === "failed" && <Notice tone="error">{job.error}</Notice>}
        {job?.status === "done" && <Notice tone="success">{t.done}</Notice>}
        {managed && (
          <Button
            icon="sync"
            disabled={pending || job?.status === "running" || job?.status === "queued"}
            onClick={() =>
              start(async () => {
                const result = await updateToolsAction();
                if ("error" in result) setError(result.error);
                else setJobId(result.id);
              })
            }
          >
            {job?.status === "running" ? t.updating : t.update}
          </Button>
        )}
      </PanelForm>
    </Panel>
  );
}
