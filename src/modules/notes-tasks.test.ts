import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertUser, useTempDatabase } from "@/test/db";

let db: Awaited<ReturnType<typeof useTempDatabase>>;
let notes: typeof import("./notes/store");
let tasks: typeof import("./tasks/store");

beforeAll(async () => {
  db = await useTempDatabase("notes");
  await insertUser("alice");
  await insertUser("bob");
  notes = await import("./notes/store");
  tasks = await import("./tasks/store");
});

afterAll(async () => {
  await db.cleanup();
});

function fileOf(userId: string, folder: string, name: string) {
  return path.join(db.dataDir, "notes", userId, ...(folder ? folder.split("/") : []), `${name}.md`);
}

describe("notes on disk", () => {
  it("writes exactly the saved Markdown to a readable .md file", () => {
    const content = "# Shopping\n\n- [ ] Milk\n- [x] Bread\n\n| a | b |\n| - | - |\n| 1 | 2 |\n";
    const created = notes.createNote("alice", { title: "Shopping list", folder: "Home", content });
    expect(fs.readFileSync(fileOf("alice", "Home", "Shopping list"), "utf8")).toBe(content);
    const saved = notes.saveNote("alice", created.id, { content: `${content}\nEggs\n` });
    expect(fs.readFileSync(fileOf("alice", "Home", "Shopping list"), "utf8")).toBe(saved.content);
  });

  it("renames and moves the file with the title and folder", () => {
    const created = notes.createNote("alice", { title: "Draft", content: "x" });
    notes.saveNote("alice", created.id, { title: "Final", folder: "Work/Reports" });
    expect(fs.existsSync(fileOf("alice", "", "Draft"))).toBe(false);
    expect(fs.readFileSync(fileOf("alice", "Work/Reports", "Final"), "utf8")).toBe("x");
  });

  it.each(["../bob", "a/../../bob", ".hidden", "C:\\Windows"])("refuses folder %j that leaves the user's notes", (folder) => {
    expect(() => notes.createNote("alice", { title: "x", folder })).toThrow();
  });

  it("turns any title into a safe file name inside the user's folder", () => {
    const created = notes.createNote("alice", { title: "../../bob/evil:<>|?*" });
    const file = fileOf("alice", "", created.fileName);
    expect(fs.existsSync(file)).toBe(true);
    expect(path.relative(path.join(db.dataDir, "notes", "alice"), file).startsWith("..")).toBe(false);
  });

  it("moves to the trash, restores and deletes without losing content", () => {
    const created = notes.createNote("alice", { title: "Temporary", content: "keep me" });
    notes.trashNote("alice", created.id);
    expect(fs.existsSync(fileOf("alice", "", "Temporary"))).toBe(false);
    expect(notes.listNotes("alice", { trashed: true }).map((row) => row.id)).toContain(created.id);
    expect(notes.searchNotes("alice", "keep")).toHaveLength(0);
    const restored = notes.restoreNote("alice", created.id);
    expect(restored.content).toBe("keep me");
    expect(() => notes.deleteNoteForever("alice", created.id)).toThrow(/trash/);
    notes.trashNote("alice", created.id);
    notes.deleteNoteForever("alice", created.id);
    expect(() => notes.getNote("alice", created.id)).toThrow();
  });

  it("keeps earlier versions and restores them", () => {
    const created = notes.createNote("alice", { title: "Versioned", content: "one" });
    notes.saveNote("alice", created.id, { content: "two" });
    const versions = notes.listVersions("alice", created.id);
    expect(versions).toHaveLength(1);
    expect(notes.restoreVersion("alice", created.id, versions[0]!.id).content).toBe("one");
  });

  it("finds notes by full text search and links", () => {
    const target = notes.createNote("alice", { title: "Garden plan", content: "tomatoes and basil" });
    notes.createNote("alice", { title: "Spring", content: "See [[Garden plan]] for details" });
    expect(notes.searchNotes("alice", "tomat").map((row) => row.id)).toContain(target.id);
    expect(notes.backlinks("alice", target.id).map((row) => row.title)).toEqual(["Spring"]);
  });

  it("refuses import paths that leave the folder", () => {
    expect(() => notes.importFiles("alice", "Imported", [{ path: "../../escape.md", content: "x" }])).toThrow();
    expect(notes.importFiles("alice", "Imported", [{ path: "sub/ok.md", content: "fine" }])).toBe(1);
  });
});

describe("one user never reads or changes another user's notes or tasks", () => {
  it("notes", () => {
    const secret = notes.createNote("alice", { title: "Secret", content: "alice only" });
    expect(() => notes.getNote("bob", secret.id)).toThrow();
    expect(() => notes.saveNote("bob", secret.id, { content: "hacked" })).toThrow();
    expect(() => notes.trashNote("bob", secret.id)).toThrow();
    expect(() => notes.setNoteTags("bob", secret.id, ["x"])).toThrow();
    expect(() => notes.listVersions("bob", secret.id)).toThrow();
    expect(notes.listNotes("bob")).toHaveLength(0);
    expect(notes.searchNotes("bob", "alice")).toHaveLength(0);
    expect(notes.getNote("alice", secret.id).content).toBe("alice only");
  });

  it("tasks", () => {
    const list = tasks.createTaskList("alice", "Home");
    const item = tasks.createTask("alice", { title: "Pay rent", listId: list.id, dueDate: "2026-11-10" });
    expect(() => tasks.getTask("bob", item.id)).toThrow();
    expect(() => tasks.updateTask("bob", item.id, { title: "x" })).toThrow();
    expect(() => tasks.setTaskDone("bob", item.id, true)).toThrow();
    expect(() => tasks.deleteTask("bob", item.id)).toThrow();
    expect(() => tasks.createTask("bob", { title: "x", listId: list.id })).toThrow();
    expect(() => tasks.createTask("bob", { title: "x", parentId: item.id })).toThrow();
    expect(tasks.listTasks("bob", "today", "2026-11-10")).toHaveLength(0);
    expect(tasks.getTask("alice", item.id).completedAt).toBeNull();
  });
});

describe("tasks", () => {
  it("sorts into today, upcoming and done", () => {
    tasks.createTask("bob", { title: "Overdue", dueDate: "2026-11-01" });
    tasks.createTask("bob", { title: "Later", dueDate: "2026-12-01" });
    const done = tasks.createTask("bob", { title: "Finished" });
    tasks.setTaskDone("bob", done.id, true);
    expect(tasks.listTasks("bob", "today", "2026-11-10").map((row) => row.title)).toEqual(["Overdue"]);
    expect(tasks.listTasks("bob", "upcoming", "2026-11-10").map((row) => row.title)).toEqual(["Later"]);
    expect(tasks.listTasks("bob", "done", "2026-11-10").map((row) => row.title)).toEqual(["Finished"]);
  });

  it("checks the linked checkbox in the note when the task is done", () => {
    const source = notes.createNote("bob", { title: "Trip", content: "- [ ] Book train\n- [ ] Pack\n" });
    const linked = tasks.createTask("bob", { title: "Book train" }, { noteId: source.id, noteItem: "Book train" });
    tasks.setTaskDone("bob", linked.id, true);
    expect(notes.getNote("bob", source.id).content).toBe("- [x] Book train\n- [ ] Pack\n");
  });
});
