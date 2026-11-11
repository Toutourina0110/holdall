"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { strings } from "@/core/strings";
import { Button, Notice } from "@/ui/controls";
import { Panel, PanelEmpty, PanelForm, PanelRow } from "@/ui/Panel";
import { useJobs } from "@/ui/useJobs";
import { convertAction } from "../files/actions";
import styles from "./converter.module.css";

type Candidate = { root: "files" | "downloads"; path: string; targets: string[] };

export function ConverterBoard({ candidates }: { candidates: Candidate[] }) {
  const t = strings.converter;
  const [selected, setSelected] = useState(0);
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string }>();
  const [pending, start] = useTransition();
  const { jobs, error } = useJobs("converter.convert");
  const current = candidates[selected];

  return (
    <>
      <Panel title={t.pick}>
        <PanelForm>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          {candidates.length === 0 ? (
            <p className={styles.meta}>{t.noTargets}</p>
          ) : (
            <>
              <label className={styles.label}>
                {t.pick}
                <select
                  className={styles.select}
                  value={selected}
                  onChange={(event) => {
                    setSelected(Number(event.target.value));
                    setTarget("");
                  }}
                >
                  {candidates.map((item, index) => (
                    <option key={`${item.root}:${item.path}`} value={index}>
                      {item.root === "downloads" ? `${strings.files.downloads} / ` : ""}
                      {item.path}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                {t.target}
                <select className={styles.select} value={target || current?.targets[0]} onChange={(event) => setTarget(event.target.value)}>
                  {current?.targets.map((value) => (
                    <option key={value} value={value}>
                      {value.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="primary"
                icon="converter"
                disabled={pending || !current}
                onClick={() =>
                  start(async () => {
                    if (!current) return;
                    const result = await convertAction(current.root, current.path, target || current.targets[0]!);
                    setMessage("error" in result ? { tone: "error", text: result.error } : { tone: "success", text: strings.files.converting });
                  })
                }
              >
                {t.start}
              </Button>
            </>
          )}
        </PanelForm>
      </Panel>
      <Panel title={t.jobsTitle} count={jobs ? String(jobs.length) : undefined}>
        {error && <PanelEmpty>{error}</PanelEmpty>}
        {!jobs && !error && <PanelEmpty>{strings.settings.loading}</PanelEmpty>}
        {jobs?.length === 0 && <PanelEmpty>{t.jobsEmpty}</PanelEmpty>}
        {jobs?.map((job) => {
          const payload = JSON.parse(job.payload) as { root: string; path: string; target: string };
          const result = job.result ? (JSON.parse(job.result) as { root: string; file: string }) : undefined;
          const folder = (result?.file ?? payload.path).split("/").slice(0, -1).join("/");
          return (
            <PanelRow key={job.id}>
              <span className={styles.grow}>
                <span className={styles.strong}>
                  {payload.path}, {payload.target.toUpperCase()}
                </span>
                <span className={styles.meta}>
                  {{ queued: strings.downloads.queued, running: `${Math.round(job.progress * 100)}%`, done: result?.file ?? strings.downloads.done, failed: job.error ?? strings.downloads.failed, cancelled: strings.downloads.cancelled }[job.status]}
                </span>
              </span>
              {job.status === "done" && (
                <Link href={`/files?root=${payload.root}&path=${encodeURIComponent(folder)}`} className={styles.link}>
                  {t.openFolder}
                </Link>
              )}
            </PanelRow>
          );
        })}
      </Panel>
    </>
  );
}
