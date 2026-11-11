import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { useTempDatabase } from "@/test/db";

let db: Awaited<ReturnType<typeof useTempDatabase>>;
let files: typeof import("./files/store");
let formats: typeof import("./converter/formats");

beforeAll(async () => {
  db = await useTempDatabase("files");
  files = await import("./files/store");
  formats = await import("./converter/formats");
  fs.mkdirSync(path.join(db.dataDir, "files", "bob"), { recursive: true });
  fs.writeFileSync(path.join(db.dataDir, "files", "bob", "secret.txt"), "bob only");
});

afterAll(async () => {
  await db.cleanup();
});

describe("file manager paths", () => {
  it.each(["../bob/secret.txt", "a/../../bob/secret.txt", "..\\bob\\secret.txt", ".hidden"])("refuses %j", (relative) => {
    expect(() => files.fileInfo("alice", "files", relative)).toThrow();
  });

  it("keeps each user in their own folder", () => {
    files.rootDir("alice", "files");
    expect(files.listFolder("alice", "files", "")).toEqual([]);
    expect(() => files.fileInfo("alice", "files", "secret.txt")).toThrow(/does not exist/);
  });

  it.each(["a/b", "..", ".env", "con", "x:y", ""])("refuses unsafe name %j", (name) => {
    expect(() => files.makeFolder("alice", "files", "", name)).toThrow();
  });

  it("creates, renames, moves and deletes inside the user's folder", () => {
    files.makeFolder("alice", "files", "", "Photos");
    files.makeFolder("alice", "files", "", "Archive");
    fs.writeFileSync(path.join(db.dataDir, "files", "alice", "Photos", "cat.png"), "png");
    const renamed = files.renameEntry("alice", "files", "Photos/cat.png", "kitty.png");
    expect(renamed).toBe("Photos/kitty.png");
    expect(files.moveEntry("alice", "files", renamed, "Archive")).toBe("Archive/kitty.png");
    expect(() => files.moveEntry("alice", "files", "Archive", "Archive")).toThrow(/into itself/);
    files.deleteEntry("alice", "files", "Archive/kitty.png");
    expect(files.listFolder("alice", "files", "Archive")).toEqual([]);
    expect(() => files.deleteEntry("alice", "files", "")).toThrow(/main folder/);
  });
});

describe("converter arguments", () => {
  it("only offers conversions that make sense", () => {
    expect(formats.targetsFor("song.mp3")).not.toContain("mp3");
    expect(formats.targetsFor("song.mp3")).toContain("flac");
    expect(formats.targetsFor("clip.mp4")).toContain("mp3");
    expect(formats.targetsFor("notes.docx")).toEqual([]);
  });

  it("never overwrites and refuses unknown targets", () => {
    const args = formats.ffmpegArgs("/data/files/u/clip.mp4", "/data/files/u/clip.webm", "webm");
    expect(args).toContain("-n");
    expect(args.at(-1)).toBe("file:/data/files/u/clip.webm");
    expect(args.slice(args.indexOf("-protocol_whitelist"), args.indexOf("-i") + 2)).toEqual(["-protocol_whitelist", "file", "-f", "mov", "-i", "file:/data/files/u/clip.mp4"]);
    expect(() => formats.ffmpegArgs("/data/files/u/clip.mp4", "/x.exe", "exe")).toThrow();
  });
});
