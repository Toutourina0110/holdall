import { describe, expect, it } from "vitest";
import { checkLink, downloadArgs, parseLinks, parseProgress, probeArgs } from "./args";

describe("links", () => {
  it.each(["--exec=calc.exe", "-o/etc/passwd", "file:///etc/passwd", "javascript:alert(1)", "ftp://example.com/x", "https://user:pass@example.com/x", "not a link"])(
    "refuses %j",
    (value) => {
      expect(() => checkLink(value)).toThrow();
    },
  );

  it("splits pasted text into unique links", () => {
    expect(parseLinks("https://youtu.be/a  https://youtu.be/a\nhttps://vimeo.com/1")).toEqual(["https://youtu.be/a", "https://vimeo.com/1"]);
  });
});

describe("yt-dlp arguments", () => {
  const base = { url: "https://youtu.be/abc", outputDir: "/data/downloads/u1" };

  it("always ends options before the link and disables config files and exec", () => {
    const args = downloadArgs({ ...base, options: { kind: "video", container: "mp4", quality: "1080", audioFormat: "mp3" } });
    expect(args.at(-2)).toBe("--");
    expect(args.at(-1)).toBe("https://youtu.be/abc");
    expect(args).toContain("--ignore-config");
    expect(args).toContain("--no-exec");
    expect(args[args.indexOf("--use-extractors") + 1]).toBe("default,-generic");
    expect(args.indexOf("-P") + 1).toBe(args.indexOf("/data/downloads/u1"));
    expect(probeArgs("https://youtu.be/abc").slice(-2)).toEqual(["--", "https://youtu.be/abc"]);
  });

  it("refuses an unsafe format id", () => {
    expect(() => downloadArgs({ ...base, options: { kind: "video", container: "mp4", quality: "best", audioFormat: "mp3", formatId: "18 --exec x" } })).toThrow();
  });

  it("extracts audio in the chosen format", () => {
    const args = downloadArgs({ ...base, options: { kind: "audio", container: "mp4", quality: "best", audioFormat: "opus" } });
    expect(args).toEqual(expect.arrayContaining(["-x", "--audio-format", "opus"]));
  });

  it("reads progress lines", () => {
    expect(parseProgress("[holdall] 42.5%|1.20MiB/s|00:31")).toEqual({ percent: 42.5, speed: "1.20MiB/s", eta: "00:31" });
    expect(parseProgress("[download] something else")).toBeUndefined();
  });
});
