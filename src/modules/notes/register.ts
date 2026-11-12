import { z } from "zod";
import { registerSlotContributor } from "@/core/layout/registry";
import { registerPluginApi } from "@/core/plugins/api";
import { createNote, getNote, listNotes, restoreNote, saveNote, searchNotes, setNoteFlags, setNoteTags, trashNote } from "./store";

registerSlotContributor("notes", () => [
  { id: "notes.page", slot: "rail.main", label: "Notes", icon: "notes", href: "/notes", order: 10, source: "notes" },
  { id: "notes.recent", slot: "dashboard.widgets", label: "Recent notes", icon: "notes", order: 20, source: "notes", builtin: { component: "notes.recent", width: 1 } },
]);

const summary = (row: { id: string; title: string; folder: string; updatedAt: Date; tags: string[] }) => ({
  id: row.id,
  title: row.title,
  folder: row.folder,
  tags: row.tags,
  updatedAt: row.updatedAt.toISOString(),
});

registerPluginApi("notes.list", "notes:read", z.object({ query: z.string().max(200).optional() }), ({ query }, { userId }) =>
  (query ? searchNotes(userId, query) : listNotes(userId)).slice(0, 200).map(summary),
);

registerPluginApi("notes.get", "notes:read", z.object({ id: z.string().max(64) }), ({ id }, { userId }) => {
  const note = getNote(userId, id);
  if (note.trashedAt) return null;
  return { ...summary(note), content: note.content };
});

registerPluginApi(
  "notes.create",
  "notes:write",
  z.object({ title: z.string().max(200), folder: z.string().max(300).optional(), content: z.string().max(5 * 1024 * 1024).optional() }),
  (input, { userId }) => summary(createNote(userId, input)),
);

registerPluginApi(
  "notes.update",
  "notes:write",
  z.object({ id: z.string().max(64), title: z.string().max(200).optional(), content: z.string().max(5 * 1024 * 1024).optional() }),
  ({ id, ...input }, { userId }) => summary(saveNote(userId, id, input)),
);

const noteId = z.object({ id: z.string().max(64) });

registerPluginApi("notes.trash", "notes:write", noteId, ({ id }, { userId }) => {
  trashNote(userId, id);
  return true;
});

registerPluginApi("notes.restore", "notes:write", noteId, ({ id }, { userId }) => summary(restoreNote(userId, id)));

registerPluginApi("notes.move", "notes:write", noteId.extend({ folder: z.string().max(300) }), ({ id, folder }, { userId }) => summary(saveNote(userId, id, { folder })));

registerPluginApi("notes.setTags", "notes:write", noteId.extend({ tags: z.array(z.string().max(40)).max(30) }), ({ id, tags }, { userId }) => setNoteTags(userId, id, tags));

registerPluginApi(
  "notes.setFlags",
  "notes:write",
  noteId.extend({ pinned: z.boolean().optional(), favorite: z.boolean().optional() }),
  ({ id, pinned, favorite }, { userId }) => {
    setNoteFlags(userId, id, { pinned, favorite });
    return true;
  },
);
