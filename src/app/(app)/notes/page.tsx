import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { strings } from "@/core/strings";
import { Button, ButtonLink } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import {
  backlinks,
  checklistItems,
  extractLinks,
  findNoteByTitle,
  getNote,
  listFolders,
  listNotes,
  listTags,
  listVersions,
  searchNotes,
  type NoteDetail,
  type NoteSummary,
} from "@/modules/notes/store";
import { tasksForNote } from "@/modules/tasks/store";
import { createNoteAction, emptyTrashAction } from "./actions";
import { ImportForm } from "./ImportForm";
import { NoteDetails } from "./NoteDetails";
import { NoteEditor } from "./NoteEditor";
import styles from "./notes.module.css";

export const metadata: Metadata = { title: strings.notes.title };

type Search = { id?: string; folder?: string; tag?: string; q?: string; view?: string };

function href(base: Search, change: Search) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...base, ...change })) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/notes?${query}` : "/notes";
}

function day(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function NotesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireSession();
  const userId = session.user.id;
  const search = await searchParams;
  const t = strings.notes;
  const view = search.view === "trash" || search.view === "favorites" ? search.view : "all";
  const listBase: Search = { folder: search.folder, tag: search.tag, q: search.q, view: view === "all" ? undefined : view };

  const items: (NoteSummary & { snippet?: string })[] = search.q
    ? searchNotes(userId, search.q)
    : listNotes(userId, { folder: search.folder, tag: search.tag, trashed: view === "trash", favorites: view === "favorites" });
  const folders = listFolders(userId);
  const tags = listTags(userId);

  let current: NoteDetail | undefined;
  let loadError: string | undefined;
  if (search.id) {
    try {
      current = getNote(userId, search.id);
    } catch (error) {
      loadError = error instanceof UserFacingError ? error.message : strings.auth.genericError;
    }
  }

  const linkedTasks = current ? tasksForNote(userId, current.id) : [];
  const empty = search.q ? t.emptySearch : view === "trash" ? t.emptyTrash : t.emptyList;

  return (
    <div className={styles.page} data-open={current ? true : undefined}>
      <nav className={styles.nav} aria-label={t.title}>
        <form action={createNoteAction}>
          <input type="hidden" name="folder" value={search.folder ?? ""} />
          <Button variant="primary" icon="plus" type="submit">
            {t.newNote}
          </Button>
        </form>
        <form className={styles.search} action="/notes" role="search">
          <Icon name="search" />
          <input name="q" defaultValue={search.q} placeholder={t.search} aria-label={t.search} />
        </form>
        <ul className={styles.navList}>
          <li>
            <Link href="/notes" aria-current={view === "all" && !search.folder && !search.tag && !search.q ? "page" : undefined}>
              <Icon name="notes" /> {t.all}
            </Link>
          </li>
          <li>
            <Link href="/notes?view=favorites" aria-current={view === "favorites" ? "page" : undefined}>
              <Icon name="star" /> {t.favorites}
            </Link>
          </li>
          <li>
            <Link href="/notes?view=trash" aria-current={view === "trash" ? "page" : undefined}>
              <Icon name="trash" /> {t.trash}
            </Link>
          </li>
        </ul>
        <h2 className={styles.navTitle}>{t.folders}</h2>
        {folders.length === 0 ? (
          <p className={styles.meta}>{t.noFolders}</p>
        ) : (
          <ul className={styles.navList}>
            {folders.map((folder) => (
              <li key={folder} style={{ paddingLeft: `calc(var(--space-3) * ${folder.split("/").length - 1})` }}>
                <Link href={`/notes?folder=${encodeURIComponent(folder)}`} aria-current={search.folder === folder ? "page" : undefined}>
                  <Icon name="folder" /> {folder.split("/").pop()}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <h2 className={styles.navTitle}>{t.tags}</h2>
        {tags.length === 0 ? (
          <p className={styles.meta}>{t.noTags}</p>
        ) : (
          <ul className={styles.tagCloud}>
            {tags.map(({ tag, count }) => (
              <li key={tag}>
                <Link href={`/notes?tag=${encodeURIComponent(tag)}`} aria-current={search.tag === tag ? "page" : undefined}>
                  #{tag} <span>{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <ImportForm folder={search.folder ?? ""} />
        <ButtonLink href={`/api/notes/export${search.folder ? `?folder=${encodeURIComponent(search.folder)}` : ""}`} icon="download">
          {t.exportFolder}
        </ButtonLink>
      </nav>

      <section className={styles.list} aria-label={t.title}>
        <header className={styles.listHead}>
          <h1>{search.q ? `"${search.q}"` : search.tag ? `#${search.tag}` : search.folder ?? (view === "trash" ? t.trash : view === "favorites" ? t.favorites : t.all)}</h1>
          <span className={styles.meta}>{items.length}</span>
          {view === "trash" && items.length > 0 && (
            <form action={emptyTrashAction}>
              <Button variant="danger" type="submit">
                {t.emptyTrashButton}
              </Button>
            </form>
          )}
        </header>
        {items.length === 0 ? (
          <p className={styles.empty}>{empty}</p>
        ) : (
          <ul className={styles.items}>
            {items.map((item) => (
              <li key={item.id}>
                <Link href={href(listBase, { id: item.id })} className={styles.item} aria-current={current?.id === item.id ? "page" : undefined}>
                  <span className={styles.itemTitle}>
                    {item.pinned && <Icon name="pin" size={14} />}
                    {item.title}
                  </span>
                  <span className={styles.itemMeta}>
                    {item.folder && <span>{item.folder}</span>}
                    <span>{day(item.updatedAt)}</span>
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </span>
                  {item.snippet && <span className={styles.snippet}>{item.snippet}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.main}>
        {current ? (
          <>
            <Link className={styles.back} href={href(listBase, { id: undefined })}>
              <Icon name="back" /> {t.back}
            </Link>
            <div className={styles.work}>
              <NoteEditor key={current.id} id={current.id} initialTitle={current.title} initialContent={current.content} readOnly={Boolean(current.trashedAt)} />
              <NoteDetails
                id={current.id}
                title={current.title}
                folder={current.folder}
                tags={current.tags}
                pinned={current.pinned}
                favorite={current.favorite}
                trashed={Boolean(current.trashedAt)}
                updatedAt={current.updatedAt.toISOString()}
                backlinks={current.trashedAt ? [] : backlinks(userId, current.id).map((row) => ({ id: row.id, title: row.title }))}
                links={extractLinks(current.content).map((title) => ({ title, id: findNoteByTitle(userId, title)?.id }))}
                versions={listVersions(userId, current.id).map((version) => ({ id: version.id, createdAt: version.createdAt.toISOString() }))}
                checklist={checklistItems(current.content).map((item) => ({
                  ...item,
                  taskId: linkedTasks.find((task) => task.noteItem === item.text)?.id,
                }))}
              />
            </div>
          </>
        ) : (
          <p className={styles.empty}>{loadError ?? t.pickNote}</p>
        )}
      </section>
    </div>
  );
}
