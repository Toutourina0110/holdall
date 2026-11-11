"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { strFromU8, unzipSync } from "fflate";
import { z } from "zod";
import { requireSession } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { doAction } from "@/core/plugins/hooks";
import {
  createNote,
  deleteNoteForever,
  emptyTrash,
  importFiles,
  restoreNote,
  restoreVersion,
  saveNote,
  setNoteFlags,
  setNoteTags,
  trashNote,
} from "@/modules/notes/store";
import { createTask } from "@/modules/tasks/store";

const id = z.string().min(1).max(64);

function failure(error: unknown) {
  return { error: error instanceof UserFacingError ? error.message : "Something went wrong. Try again in a moment." };
}

export async function createNoteAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const folder = String(formData.get("folder") ?? "");
  const note = createNote(session.user.id, { title: "Untitled", folder, content: "" });
  revalidatePath("/notes");
  redirect(`/notes?id=${note.id}${folder ? `&folder=${encodeURIComponent(folder)}` : ""}`);
}

export async function saveNoteAction(noteId: string, input: { title?: string; content?: string; folder?: string }) {
  const session = await requireSession();
  const parsed = z
    .object({ title: z.string().max(200).optional(), content: z.string().max(5 * 1024 * 1024).optional(), folder: z.string().max(300).optional() })
    .safeParse(input);
  if (!id.safeParse(noteId).success || !parsed.success) return { error: "This change could not be read." };
  try {
    const note = saveNote(session.user.id, noteId, parsed.data);
    void doAction("notes.saved", { id: note.id, title: note.title }, { userId: session.user.id }).catch(() => undefined);
    return { updatedAt: note.updatedAt.toISOString(), folder: note.folder, title: note.title };
  } catch (error) {
    return failure(error);
  }
}

export async function setFlagsAction(noteId: string, flags: { pinned?: boolean; favorite?: boolean }) {
  const session = await requireSession();
  const parsed = z.object({ pinned: z.boolean().optional(), favorite: z.boolean().optional() }).safeParse(flags);
  if (!parsed.success) return;
  setNoteFlags(session.user.id, noteId, parsed.data);
  revalidatePath("/notes");
}

export async function setTagsAction(noteId: string, tags: string) {
  const session = await requireSession();
  const saved = setNoteTags(session.user.id, noteId, String(tags).split(","));
  revalidatePath("/notes");
  return saved;
}

export async function trashNoteAction(noteId: string) {
  const session = await requireSession();
  trashNote(session.user.id, noteId);
  void doAction("notes.deleted", { id: noteId }, { userId: session.user.id }).catch(() => undefined);
  revalidatePath("/notes");
  redirect("/notes");
}

export async function restoreNoteAction(noteId: string) {
  const session = await requireSession();
  restoreNote(session.user.id, noteId);
  revalidatePath("/notes");
  redirect(`/notes?id=${noteId}`);
}

export async function deleteForeverAction(noteId: string) {
  const session = await requireSession();
  deleteNoteForever(session.user.id, noteId);
  revalidatePath("/notes");
  redirect("/notes?view=trash");
}

export async function emptyTrashAction() {
  const session = await requireSession();
  emptyTrash(session.user.id);
  revalidatePath("/notes");
}

export async function restoreVersionAction(noteId: string, versionId: string): Promise<{ error?: string }> {
  const session = await requireSession();
  try {
    restoreVersion(session.user.id, noteId, versionId);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/notes");
  return {};
}

export async function makeTaskAction(noteId: string, text: string): Promise<{ error?: string }> {
  const session = await requireSession();
  try {
    createTask(session.user.id, { title: String(text).slice(0, 300) }, { noteId, noteItem: String(text) });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/notes");
  revalidatePath("/tasks");
  return {};
}

export async function importNotesAction(_state: { message?: string; error?: string }, formData: FormData): Promise<{ message?: string; error?: string }> {
  const session = await requireSession();
  const folder = String(formData.get("folder") ?? "");
  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  const entries: { path: string; content: string }[] = [];
  let total = 0;
  try {
    for (const file of files) {
      total += file.size;
      if (total > 50 * 1024 * 1024) throw new UserFacingError("Imports are limited to 50 MB at a time.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (/\.zip$/i.test(file.name)) {
        let unpacked = 0;
        const unzipped = unzipSync(bytes, {
          filter(entry) {
            unpacked += entry.originalSize;
            if (unpacked > 100 * 1024 * 1024) throw new UserFacingError("This zip is too large once unpacked.");
            return /\.(md|markdown|txt)$/i.test(entry.name);
          },
        });
        for (const [name, data] of Object.entries(unzipped)) entries.push({ path: name, content: strFromU8(data) });
      } else {
        entries.push({ path: file.name, content: new TextDecoder().decode(bytes) });
      }
    }
    const count = importFiles(session.user.id, folder, entries);
    revalidatePath("/notes");
    return count > 0 ? { message: String(count) } : { error: "none" };
  } catch (error) {
    return error instanceof UserFacingError ? { error: error.message } : { error: "none" };
  }
}
