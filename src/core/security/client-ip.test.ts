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
