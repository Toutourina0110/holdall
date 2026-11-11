import { describe, expect, it } from "vitest";
import { desktopGate } from "./desktop-gate";

const token = "a".repeat(64);
const base = { token, port: 41234 };

describe("desktop gate", () => {
  it("accepts the launch token once, then the cookie", () => {
    expect(desktopGate({ ...base, host: "127.0.0.1:41234", queryToken: token })).toBe("set-cookie");
    expect(desktopGate({ ...base, host: "127.0.0.1:41234", cookieToken: token })).toBe("allow");
    expect(desktopGate({ ...base, host: "localhost:41234", cookieToken: token })).toBe("allow");
  });

  it.each([
    [{ host: "127.0.0.1:41234" }],
    [{ host: "127.0.0.1:41234", cookieToken: "b".repeat(64) }],
    [{ host: "127.0.0.1:41234", queryToken: "short" }],
    [{ host: "evil.example:41234", cookieToken: token }],
    [{ host: "127.0.0.1:9999", cookieToken: token }],
    [{ host: undefined, cookieToken: token }],
  ])("refuses %j", (input) => {
    expect(desktopGate({ ...base, ...input })).toBe("deny");
  });

  it("refuses everything when no token was configured", () => {
    expect(desktopGate({ token: undefined, port: 41234, host: "127.0.0.1:41234", cookieToken: "" })).toBe("deny");
  });
});
