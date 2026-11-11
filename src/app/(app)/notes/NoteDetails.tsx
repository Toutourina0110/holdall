"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { strings } from "@/core/strings";
import { Button, ButtonLink, Field, IconButton, Notice } from "@/ui/controls";
import {
  deleteForeverAction,
  makeTaskAction,
  restoreNoteAction,
  restoreVersionAction,
  saveNoteAction,
  setFlagsAction,
  setTagsAction,
  trashNoteAction,
} from "./actions";
import styles from "./notes.module.css";

type Props = {
  id: string;
  title: string;
  folder: string;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  trashed: boolean;
  updatedAt: string;
  backlinks: { id: string; title: string }[];
  links: { title: string; id?: string }[];
  versions: { id: string; createdAt: string }[];
  checklist: { text: string; done: boolean; taskId?: string }[];
  exportFormats: { pluginId: string; id: string; label: string }[];
};

function when(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function NoteDetails(props: Props) {
  const t = strings.notes;
  const [pending, start] = useTransition();
  const [folder, setFolder] = useState(props.folder);
  const [tags, setTags] = useState(props.tags.join(", "));
  const [error, setError] = useState<string>();

  if (props.trashed) {
    return (
      <aside className={styles.details} aria-label={t.details}>
        <Notice tone="warn">{t.trashedNotice}</Notice>
        <div className={styles.detailActions}>
          <Button variant="primary" icon="reset" disabled={pending} onClick={() => start(() => restoreNoteAction(props.id))}>
            {t.restore}
          </Button>
          <Button
            variant="danger"
            icon="trash"
            disabled={pending}
            onClick={() => {
              if (window.confirm(t.deleteConfirm)) start(() => deleteForeverAction(props.id));
            }}
          >
            {t.deleteForever}
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.details} aria-label={t.details}>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.detailActions}>
        <IconButton icon="pin" label={props.pinned ? t.unpin : t.pin} aria-pressed={props.pinned} onClick={() => start(() => setFlagsAction(props.id, { pinned: !props.pinned }))} />
        <IconButton
          icon="star"
          label={props.favorite ? t.unfavorite : t.favorite}
          aria-pressed={props.favorite}
          onClick={() => start(() => setFlagsAction(props.id, { favorite: !props.favorite }))}
        />
        <ButtonLink href={`/api/notes/export?id=${props.id}`} icon="download">
          {t.export}
        </ButtonLink>
        {props.exportFormats.map((format) => (
          <ButtonLink
            key={`${format.pluginId}:${format.id}`}
            href={`/api/notes/export?id=${props.id}&plugin=${encodeURIComponent(format.pluginId)}&format=${encodeURIComponent(format.id)}`}
            icon="download"
          >
            {format.label}
          </ButtonLink>
        ))}
        <IconButton icon="trash" label={t.moveToTrash} onClick={() => start(() => trashNoteAction(props.id))} />
      </div>
      <p className={styles.meta}>
        {t.updated} {when(props.updatedAt)}
      </p>

      <form
        className={styles.detailForm}
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            const result = await saveNoteAction(props.id, { folder });
            setError("error" in result ? result.error : undefined);
            if ("folder" in result && result.folder !== undefined) setFolder(result.folder);
            const saved = await setTagsAction(props.id, tags);
            setTags(saved.join(", "));
          });
        }}
      >
        <Field label={t.folderLabel} name="folder" value={folder} hint={t.folderHint} onChange={(event) => setFolder(event.target.value)} />
        <Field label={t.tagsLabel} name="tags" value={tags} hint={t.tagsHint} onChange={(event) => setTags(event.target.value)} />
        <Button type="submit" disabled={pending}>
          {t.saveDetails}
        </Button>
      </form>

      <section className={styles.detailSection}>
        <h3>{t.backlinks}</h3>
        {props.backlinks.length === 0 ? (
          <p className={styles.meta}>{t.noBacklinks.replace("{title}", props.title)}</p>
        ) : (
          <ul className={styles.linkList}>
            {props.backlinks.map((link) => (
              <li key={link.id}>
                <Link href={`/notes?id=${link.id}`}>{link.title}</Link>
              </li>
            ))}
          </ul>
        )}
        {props.links.length > 0 && (
          <>
            <h3>{t.links}</h3>
            <ul className={styles.linkList}>
              {props.links.map((link) => (
                <li key={link.title}>{link.id ? <Link href={`/notes?id=${link.id}`}>{link.title}</Link> : <span className={styles.meta}>{`${link.title} (${t.missingLink})`}</span>}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={styles.detailSection}>
        <h3>{t.checklist}</h3>
        {props.checklist.length === 0 && <p className={styles.meta}>{t.noChecklist}</p>}
        <ul className={styles.checklist}>
          {props.checklist.map((item) => (
            <li key={item.text}>
              <span data-done={item.done || undefined}>{item.text}</span>
              {item.taskId ? (
                <Link href="/tasks" className={styles.meta}>
                  {t.linkedTask}
                </Link>
              ) : (
                <Button
                  disabled={pending || item.done}
                  onClick={() =>
                    start(async () => {
                      const result = await makeTaskAction(props.id, item.text);
                      setError(result.error);
                    })
                  }
                >
                  {t.makeTask}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.detailSection}>
        <h3>{t.versions}</h3>
        {props.versions.length === 0 && <p className={styles.meta}>{t.noVersions}</p>}
        <ul className={styles.linkList}>
          {props.versions.map((version) => (
            <li key={version.id} className={styles.versionRow}>
              <span>{when(version.createdAt)}</span>
              <Button
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(t.restoreVersionConfirm)) return;
                  start(async () => {
                    const result = await restoreVersionAction(props.id, version.id);
                    if (result.error) setError(result.error);
                    else window.location.reload();
                  });
                }}
              >
                {t.restoreVersion}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
