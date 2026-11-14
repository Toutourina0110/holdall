import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, describe, expect, it } from "vitest";
import { clientIpHeader, installClientIpHeader } from "./client-ip";

const uninstall = installClientIpHeader(http);

afterAll(() => {
  uninstall();
});

describe("client ip header", () => {
  it("replaces a spoofed value with the real socket address", async () => {
    const server = http.createServer((req, res) => {
      res.end(String(req.headers[clientIpHeader]));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/`, { headers: { [clientIpHeader]: "203.0.113.9" } });
    const seen = await response.text();
    server.close();
    expect(seen).not.toBe("203.0.113.9");
    expect(seen).toMatch(/127\.0\.0\.1/);
  });
});

describe("client ip behind a proxy", () => {
  const headers = (values: Record<string, string>) => (name: string) => values[name];

  it("reads only the configured header, and the proxy-added end of X-Forwarded-For", async () => {
    const { proxiedClientIp } = await import("./client-ip");
    const spoofed = headers({ "cf-connecting-ip": "6.6.6.6", "x-real-ip": "7.7.7.7", "x-forwarded-for": "8.8.8.8, 203.0.113.5" });
    expect(proxiedClientIp(spoofed, "x-forwarded-for")).toBe("203.0.113.5");
    expect(proxiedClientIp(spoofed, "cf-connecting-ip")).toBe("6.6.6.6");
    expect(proxiedClientIp(headers({}), "x-real-ip")).toBeUndefined();
  });

  it("takes the proxy header in the server hook only when the proxy is trusted", async () => {
    uninstall();
    const restore = installClientIpHeader(http, { trustProxy: true, header: "x-forwarded-for" });
    const server = http.createServer((req, res) => res.end(String(req.headers[clientIpHeader])));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const seen = await (await fetch(`http://127.0.0.1:${port}/`, { headers: { "x-forwarded-for": "1.1.1.1, 198.51.100.7", "cf-connecting-ip": "6.6.6.6" } })).text();
    server.close();
    restore();
    expect(seen).toBe("198.51.100.7");
  });
});
