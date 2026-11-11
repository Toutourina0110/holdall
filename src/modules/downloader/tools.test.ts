import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checksumFor, verified } from "./tools";

const binary = Buffer.from("yt-dlp binary");
const hash = createHash("sha256").update(binary).digest("hex");
const sums = `${"0".repeat(64)}  yt-dlp_macos\n${hash}  yt-dlp.exe\n${"1".repeat(64)} *yt-dlp_linux\n`;

describe("tool checksums", () => {
  it("finds the published checksum for an asset", () => {
    expect(checksumFor(sums, "yt-dlp.exe")).toBe(hash);
    expect(checksumFor(sums, "yt-dlp_linux")).toBe("1".repeat(64));
    expect(checksumFor(sums, "yt-dlp")).toBeUndefined();
  });

  it("refuses a binary that does not match or has no checksum", () => {
    expect(() => verified(binary, hash, "yt-dlp.exe")).not.toThrow();
    expect(() => verified(Buffer.from("tampered"), hash, "yt-dlp.exe")).toThrow(/does not match/);
    expect(() => verified(binary, undefined, "yt-dlp.exe")).toThrow(/no published checksum/);
  });
});
