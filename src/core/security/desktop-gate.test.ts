import { describe, expect, it } from "vitest";
import { afterEach, vi } from "vitest";
import { desktopGate, desktopRequestAllowed } from "./desktop-gate";

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

describe("desktop requests outside the proxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("needs the launch cookie and the right host", () => {
    vi.stubEnv("HOLDALL_LAUNCH_TOKEN", token);
    vi.stubEnv("PORT", "41234");
    const ok = new Request("http://127.0.0.1:41234/api/files/upload", { headers: { host: "127.0.0.1:41234", cookie: `a=1; holdall_launch=${token}` } });
    const noCookie = new Request("http://127.0.0.1:41234/api/files/upload", { headers: { host: "127.0.0.1:41234" } });
    const badHost = new Request("http://127.0.0.1:41234/api/files/upload", { headers: { host: "evil.example", cookie: `holdall_launch=${token}` } });
    expect(desktopRequestAllowed(ok)).toBe(true);
    expect(desktopRequestAllowed(noCookie)).toBe(false);
    expect(desktopRequestAllowed(badHost)).toBe(false);
  });
});
