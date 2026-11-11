import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { isBlockedAddress, safeFetch } from "./safe-fetch";

describe("isBlockedAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "224.0.0.1", "::ffff:7f00:1", "64:ff9b::7f00:1", "64:ff9b::a00:1", "2002:7f00:1::", "::7f00:1", "fec0::1", "100::1", "not-an-ip"])(
    "blocks %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(true);
    },
  );

  it.each(["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111", "64:ff9b::14fa:7748"])("allows public %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

describe("safeFetch", () => {
  it("refuses to connect to loopback, even by name", async () => {
    const server = http.createServer((_req, res) => res.end("internal"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    await expect(safeFetch(`http://127.0.0.1:${port}/`, { allowHttp: true })).rejects.toThrow(/private|internal/);
    await expect(safeFetch(`http://localhost:${port}/`, { allowHttp: true })).rejects.toThrow(/private|internal/);
    server.close();
  });

  it("refuses plain http unless allowed", async () => {
    await expect(safeFetch("http://example.com/")).rejects.toThrow(/https/);
  });
});
