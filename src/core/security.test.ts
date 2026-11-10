import path from "node:path";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";
import { userPath } from "./paths";

const secret = "a-test-secret-that-is-long-enough-1234567890";
const dataDir = path.resolve("/data");

describe("userPath", () => {
  it("builds a path inside the user's folder", () => {
    expect(userPath(dataDir, "notes", "u1", "a", "b.md")).toBe(path.join(dataDir, "notes", "u1", "a", "b.md"));
  });

  it.each([["..", "x"], ["../u2/secret.md"], ["a/../../u2/x"], [path.resolve("/etc/passwd")], ["C:\\Windows\\win.ini"]])(
    "rejects an escape attempt %j",
    (...segments) => {
      expect(() => userPath(dataDir, "notes", "u1", ...segments)).toThrow(/outside/);
    },
  );

  it.each(["", "..", "u1/../u2", "u1\\x", "u 1"])("rejects an invalid user id %j", (userId) => {
    expect(() => userPath(dataDir, "notes", userId)).toThrow(/user id/);
  });
});

describe("encrypt", () => {
  it("round-trips a value", () => {
    expect(decrypt(encrypt("caldav-password", secret), secret)).toBe("caldav-password");
  });

  it("never produces the same ciphertext twice", () => {
    expect(encrypt("same", secret)).not.toBe(encrypt("same", secret));
  });

  it("refuses a tampered payload", () => {
    const payload = encrypt("token", secret);
    const tampered = payload.slice(0, -4) + (payload.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => decrypt(tampered, secret)).toThrow();
  });

  it("refuses the wrong secret", () => {
    expect(() => decrypt(encrypt("token", secret), "another-secret-that-is-long-enough-12345")).toThrow();
  });
});
