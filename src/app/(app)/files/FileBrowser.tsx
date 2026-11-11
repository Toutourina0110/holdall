"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { Entry, Root } from "@/modules/files/store";
import { strings } from "@/core/strings";
import { Button, ButtonLink, IconButton, Notice } from "@/ui/controls";
import { Icon, type IconName } from "@/ui/Icon";
import { convertAction, deleteAction, makeFolderAction, moveAction, renameAction } from "./actions";
import styles from "./files.module.css";

type Item = Entry & { targets: string[] };

const icons: Record<Entry["type"], IconName> = {
  folder: "folder",
  image: "image",
  video: "play",
  audio: "sun",
  pdf: "notes",
  text: "notes",
  other: "files",
};

function bytes(size: number) {
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

function rawUrl(root: Root, path: string, download = false) {
  return `/api/files/raw?root=${root}&path=${encodeURIComponent(path)}${download ? "&download=1" : ""}`;
}

function Preview({ root, item, onClose }: { root: Root; item: Item; onClose: () => void }) {
  const t = strings.files;
  const url = rawUrl(root, item.path);
  return (
    <aside className={styles.preview} aria-label={t.preview}>
      <header className={styles.previewHead}>
        <h2>{item.name}</h2>
        <IconButton icon="x" label={t.closePreview} onClick={onClose} />
      </header>
      <div className={styles.previewBody}>
        {item.type === "image" && <iframe src={url} title={item.name} className={styles.frame} />}
        {item.type === "video" && <video src={url} controls className={styles.media} />}
        {item.type === "audio" && <audio src={url} controls className={styles.audio} />}
        {(item.type === "pdf" || item.type === "text") && <iframe src={url} title={item.name} className={styles.frame} />}
        {item.type === "other" && <p className={styles.meta}>{t.noPreview}</p>}
      </div>
    </aside>
  );
}

function Row({
  root,
  item,
  folders,
  onPreview,
  onError,
  onNotice,
}: {
  root: Root;
  item: Item;
  folders: string[];
  onPreview: () => void;
  onError: (message?: string) => void;
  onNotice: (message: string) => void;
}) {
  const t = strings.files;
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"move" | "convert">();
  const [choice, setChoice] = useState("");
  const folder = item.kind === "folder";

  function act(work: () => Promise<{ error?: string } | object>) {
    start(async () => {
      const result = (await work()) as { error?: string };
      onError(result.error);
    });
  }

  return (
    <li className={styles.row}>
      <div className={styles.line}>
        <span className={styles.icon}>
          <Icon name={icons[item.type]} />
        </span>
        {folder ? (
          <Link className={styles.name} href={`/files?root=${root}&path=${encodeURIComponent(item.path)}`}>
            {item.name}
          </Link>
        ) : (
          <button type="button" className={styles.name} onClick={onPreview}>
            {item.name}
          </button>
        )}
        <span className={styles.meta}>{bytes(item.size)}</span>
        <span className={`${styles.meta} ${styles.date}`}>{new Date(item.modified).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
        <span className={styles.actions}>
          {!folder && (
            <a className={styles.iconLink} href={rawUrl(root, item.path, true)} aria-label={`${t.download} ${item.name}`} title={t.download}>
              <Icon name="download" />
            </a>
          )}
          {item.targets.length > 0 && <IconButton icon="converter" label={`${t.convert} ${item.name}`} onClick={() => setMode(mode === "convert" ? undefined : "convert")} />}
          <IconButton
            icon="heading"
            label={`${t.rename} ${item.name}`}
            disabled={pending}
            onClick={() => {
              const name = window.prompt(t.renamePrompt, item.name);
              if (name && name !== item.name) act(() => renameAction(root, item.path, name));
            }}
          />
          <IconButton icon="folder" label={`${t.move} ${item.name}`} onClick={() => setMode(mode === "move" ? undefined : "move")} />
          <IconButton
            icon="trash"
            label={`${t.delete} ${item.name}`}
            disabled={pending}
            onClick={() => {
              if (window.confirm(t.deleteConfirm.replace("{name}", item.name))) act(() => deleteAction(root, item.path));
            }}
          />
        </span>
      </div>
      {mode && (
        <form
          className={styles.inlineForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (mode === "move") act(() => moveAction(root, item.path, choice));
            else
              start(async () => {
                const result = await convertAction(root, item.path, choice || item.targets[0]!);
                if ("error" in result) onError(result.error);
                else onNotice(t.converting);
              });
            setMode(undefined);
          }}
        >
          <label>
            {mode === "move" ? t.moveTo : t.convertTo}
            <select value={choice} onChange={(event) => setChoice(event.target.value)} className={styles.select}>
              {(mode === "move" ? folders.filter((path) => path !== item.path && !path.startsWith(`${item.path}/`)) : item.targets).map((value) => (
                <option key={value} value={value}>
                  {mode === "move" ? value || t.root : value.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="primary" disabled={pending}>
            {mode === "move" ? t.moveHere : t.convert}
          </Button>
        </form>
      )}
    </li>
  );
}

export function FileBrowser({ root, path, entries, folders }: { root: Root; path: string; entries: Item[]; folders: string[] }) {
  const t = strings.files;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [progress, setProgress] = useState<{ name: string; percent: number }>();
  const [preview, setPreview] = useState<Item>();
  const [pending, start] = useTransition();

  function upload(file: File) {
    return new Promise<string | undefined>((resolve) => {
      const request = new XMLHttpRequest();
      request.open("POST", `/api/files/upload?root=${root}&path=${encodeURIComponent(path)}`);
      request.setRequestHeader("x-file-name", encodeURIComponent(file.name));
      request.upload.onprogress = (event) => setProgress({ name: file.name, percent: event.lengthComputable ? Math.round((event.loaded / event.total) * 100) : 0 });
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) resolve(undefined);
        else {
          try {
            resolve((JSON.parse(request.responseText) as { error?: string }).error ?? strings.auth.genericError);
          } catch {
            resolve(strings.auth.genericError);
          }
        }
      };
      request.onerror = () => resolve(strings.auth.genericError);
      request.send(file);
    });
  }

  async function uploadAll(files: FileList) {
    setError(undefined);
    let count = 0;
    for (const file of Array.from(files)) {
      const problem = await upload(file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        break;
      }
      count += 1;
    }
    setProgress(undefined);
    if (count) setNotice(t.uploaded.replace("{count}", String(count)));
    router.refresh();
  }

  const crumbs = path ? path.split("/") : [];

  return (
    <div className={styles.layout} data-preview={preview ? true : undefined}>
      <section className={styles.panel}>
        <header className={styles.head}>
          <nav className={styles.crumbs} aria-label={t.title}>
            <Link href={`/files?root=${root}`}>{root === "files" ? t.myFiles : t.downloads}</Link>
            {crumbs.map((part, index) => (
              <span key={index}>
                <span aria-hidden="true">/</span>
                <Link href={`/files?root=${root}&path=${encodeURIComponent(crumbs.slice(0, index + 1).join("/"))}`}>{part}</Link>
              </span>
            ))}
          </nav>
          <div className={styles.tools}>
            <Button
              icon="folder"
              disabled={pending}
              onClick={() => {
                const name = window.prompt(t.folderName);
                if (name)
                  start(async () => {
                    const result = await makeFolderAction(root, path, name);
                    setError("error" in result ? result.error : undefined);
                  });
              }}
            >
              {t.newFolder}
            </Button>
            <Button variant="primary" icon="upload" disabled={Boolean(progress)} onClick={() => input.current?.click()}>
              {t.upload}
            </Button>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                if (event.target.files?.length) void uploadAll(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
        </header>
        {progress && (
          <div className={styles.progress} role="status">
            <span>{t.uploading.replace("{name}", progress.name)}</span>
            <span className={styles.bar}>
              <b style={{ width: `${progress.percent}%` }} />
            </span>
          </div>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}
        {entries.length === 0 ? (
          <p className={styles.empty}>{t.empty}</p>
        ) : (
          <ul className={styles.list}>
            {entries.map((item) => (
              <Row key={item.path} root={root} item={item} folders={folders} onPreview={() => setPreview(item)} onError={setError} onNotice={setNotice} />
            ))}
          </ul>
        )}
      </section>
      {preview && <Preview root={root} item={preview} onClose={() => setPreview(undefined)} />}
      <ButtonLink href="/converter" icon="converter">
        {strings.converter.title}
      </ButtonLink>
    </div>
  );
}
