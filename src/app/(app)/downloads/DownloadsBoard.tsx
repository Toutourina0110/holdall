"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import type { ProbeResult } from "@/modules/downloader/jobs";
import { strings } from "@/core/strings";
import { Button, ButtonLink, Field, IconButton, Notice, Segmented } from "@/ui/controls";
import { Panel, PanelEmpty, PanelForm, PanelRow } from "@/ui/Panel";
import { useJobs, type ClientJob } from "@/ui/useJobs";
import { probeLinksAction, removeDownloadAction, startDownloadsAction } from "./actions";
import styles from "./downloads.module.css";

type Options = { kind: "video" | "audio"; container: "mp4" | "webm" | "mkv"; quality: string; audioFormat: "mp3" | "m4a" | "opus" };

function duration(seconds?: number) {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function bytes(size?: number) {
  if (!size) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

function OptionsPicker({ value, onChange }: { value: Options; onChange: (next: Options) => void }) {
  const t = strings.downloads;
  return (
    <div className={styles.options}>
      <Segmented label={t.kind} value={value.kind} onChange={(kind) => onChange({ ...value, kind })} options={[{ value: "video", label: t.video }, { value: "audio", label: t.audio }]} />
      {value.kind === "video" ? (
        <>
          <Segmented
            label={t.container}
            value={value.container}
            onChange={(container) => onChange({ ...value, container })}
            options={[
              { value: "mp4", label: "MP4" },
              { value: "webm", label: "WebM" },
              { value: "mkv", label: "MKV" },
            ]}
          />
          <label className={styles.selectLabel}>
            <span>{t.quality}</span>
            <select className={styles.select} value={value.quality} onChange={(event) => onChange({ ...value, quality: event.target.value })}>
              <option value="best">{t.best}</option>
              {["2160", "1440", "1080", "720", "480", "360"].map((height) => (
                <option key={height} value={height}>
                  {height}p
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <Segmented
          label={t.audioFormat}
          value={value.audioFormat}
          onChange={(audioFormat) => onChange({ ...value, audioFormat })}
          options={[
            { value: "mp3", label: "MP3" },
            { value: "m4a", label: "M4A" },
            { value: "opus", label: "Opus" },
          ]}
        />
      )}
    </div>
  );
}

function ProbeCard({ job, onDismiss }: { job: ClientJob; onDismiss: () => void }) {
  const t = strings.downloads;
  const [options, setOptions] = useState<Options>({ kind: "video", container: "mp4", quality: "1080", audioFormat: "mp3" });
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string }>();
  const [pending, start] = useTransition();
  const url = (JSON.parse(job.payload) as { url: string }).url;

  if (job.status === "queued" || job.status === "running") {
    return (
      <PanelRow>
        <span className={styles.grow}>{url}</span>
        <span className={styles.meta}>{t.checking}</span>
      </PanelRow>
    );
  }
  if (job.status !== "done" || !job.result) {
    return (
      <PanelRow>
        <span className={styles.grow}>
          {url}
          <span className={styles.error}>{job.error}</span>
        </span>
        <IconButton icon="x" label={t.dismiss} onClick={onDismiss} />
      </PanelRow>
    );
  }
  const info = JSON.parse(job.result) as ProbeResult;
  const items = info.kind === "playlist" ? info.entries : [{ url: info.url, title: info.title }];

  return (
    <div className={styles.probe}>
      <div className={styles.probeHead}>
        <div className={styles.grow}>
          <p className={styles.strong}>{info.title}</p>
          <p className={styles.meta}>
            {[info.uploader, duration(info.duration), info.kind === "playlist" ? t.playlist.replace("{count}", String(info.entries.length)) : undefined]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
        <IconButton icon="x" label={t.dismiss} onClick={onDismiss} />
      </div>
      <OptionsPicker value={options} onChange={setOptions} />
      {info.formats.length > 0 && (
        <details className={styles.formats}>
          <summary>{t.formatsShow.replace("{count}", String(info.formats.length))}</summary>
          <table>
            <tbody>
              {info.formats.map((format) => (
                <tr key={format.id}>
                  <td>{format.id}</td>
                  <td>{format.ext}</td>
                  <td>{format.height ? `${format.height}p${format.fps ? ` ${format.fps}fps` : ""}` : t.audio}</td>
                  <td>{[format.vcodec, format.acodec].filter(Boolean).join(" + ")}</td>
                  <td>{bytes(format.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div>
        <Button
          variant="primary"
          icon="download"
          disabled={pending || items.length === 0}
          onClick={() =>
            start(async () => {
              const result = await startDownloadsAction(items, options);
              if ("error" in result) setMessage({ tone: "error", text: result.error });
              else onDismiss();
            })
          }
        >
          {info.kind === "playlist" ? t.startAll.replace("{count}", String(items.length)) : t.start}
        </Button>
      </div>
    </div>
  );
}

function QueueRow({ job, onRemoved }: { job: ClientJob; onRemoved: () => void }) {
  const t = strings.downloads;
  const [pending, start] = useTransition();
  const payload = JSON.parse(job.payload) as { url: string; title?: string };
  const [speed, eta] = (job.message ?? "").split("|");
  const label = { queued: t.queued, running: t.running, done: t.done, failed: t.failed, cancelled: t.cancelled }[job.status];
  async function act(action: "cancel" | "retry") {
    await fetch(`/api/jobs/${encodeURIComponent(job.id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  }
  return (
    <PanelRow>
      <span className={styles.grow}>
        <span className={styles.strong}>{payload.title ?? payload.url}</span>
        <span className={styles.meta}>
          {label}
          {job.status === "running" && speed ? `, ${speed}` : ""}
          {job.status === "running" && eta ? `, ${eta} ${t.left}` : ""}
          {job.status === "failed" && job.error ? `: ${job.error}` : ""}
        </span>
      </span>
      <span className={styles.trail} data-state={job.status}>
        <b style={{ width: `${Math.round(job.progress * 100)}%` }} />
      </span>
      <span className={styles.percent}>{Math.round(job.progress * 100)}%</span>
      <span className={styles.actions}>
        {(job.status === "queued" || job.status === "running") && <IconButton icon="pause" label={t.pause} disabled={pending} onClick={() => start(() => act("cancel"))} />}
        {(job.status === "cancelled" || job.status === "failed") && (
          <IconButton icon="play" label={job.status === "failed" ? t.retry : t.resume} disabled={pending} onClick={() => start(() => act("retry"))} />
        )}
        {job.status === "done" && (
          <ButtonLink href={`/api/downloads/${job.id}/file`} icon="download">
            {t.open}
          </ButtonLink>
        )}
        {job.status !== "running" && (
          <IconButton
            icon="x"
            label={t.remove}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await removeDownloadAction(job.id);
                if (!("error" in result)) onRemoved();
              })
            }
          />
        )}
      </span>
    </PanelRow>
  );
}

export function DownloadsBoard() {
  const t = strings.downloads;
  const [links, setLinks] = useState("");
  const [error, setError] = useState<string>();
  const [probeIds, setProbeIds] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const probes = useJobs("downloader.probe");
  const queue = useJobs("downloader.download");
  const shownProbes = useMemo(() => (probes.jobs ?? []).filter((job) => probeIds.includes(job.id) && !hidden.includes(job.id)), [probes.jobs, probeIds, hidden]);
  const visibleQueue = (queue.jobs ?? []).filter((job) => !hidden.includes(job.id));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start(async () => {
      const result = await probeLinksAction(links);
      if ("error" in result) setError(result.error);
      else {
        setError(undefined);
        setLinks("");
        setProbeIds((current) => [...result.ids, ...current]);
      }
    });
  }

  return (
    <>
      <Panel title={t.addTitle}>
        <form onSubmit={submit}>
          <PanelForm>
            {error && <Notice tone="error">{error}</Notice>}
            <Field label={t.linksLabel} name="links" multiline value={links} hint={t.linksHint} onChange={(event) => setLinks(event.target.value)} />
            <Button variant="primary" type="submit" icon="search" disabled={pending || !links.trim()}>
              {t.check}
            </Button>
            <p className={styles.meta}>{t.notice}</p>
          </PanelForm>
        </form>
        {shownProbes.map((job) => (
          <ProbeCard key={job.id} job={job} onDismiss={() => setHidden((current) => [...current, job.id])} />
        ))}
      </Panel>
      <Panel title={t.queueTitle} count={queue.jobs ? String(visibleQueue.length) : undefined}>
        {queue.error && <PanelEmpty>{queue.error}</PanelEmpty>}
        {!queue.jobs && !queue.error && <PanelEmpty>{strings.settings.loading}</PanelEmpty>}
        {queue.jobs && visibleQueue.length === 0 && <PanelEmpty>{t.queueEmpty}</PanelEmpty>}
        {visibleQueue.map((job) => (
          <QueueRow key={job.id} job={job} onRemoved={() => setHidden((current) => [...current, job.id])} />
        ))}
      </Panel>
    </>
  );
}
