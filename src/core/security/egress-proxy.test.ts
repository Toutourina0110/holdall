import net from "node:net";
import { describe, expect, it } from "vitest";
import { egressProxyUrl } from "./egress-proxy";

async function connectThrough(proxy: string, target: string, auth = true): Promise<string> {
  const url = new URL(proxy);
  const credentials = Buffer.from(`${url.username}:${url.password}`).toString("base64");
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(url.port), url.hostname, () => {
      socket.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n${auth ? `Proxy-Authorization: Basic ${credentials}\r\n` : ""}\r\n`);
    });
    socket.once("data", (data) => {
      resolve(data.toString().split("\r\n")[0] ?? "");
      socket.destroy();
    });
    socket.on("error", reject);
  });
}

describe("egress proxy", () => {
  it("requires its credentials", async () => {
    expect(await connectThrough(await egressProxyUrl(), "example.com:443", false)).toContain("407");
  });

  it.each(["127.0.0.1:443", "localhost:443", "169.254.169.254:80", "10.0.0.1:443", "example.com:22"])("refuses %s", async (target) => {
    expect(await connectThrough(await egressProxyUrl(), target)).toContain("403");
  });
});

describe("egress proxy plain http", () => {
  it.each(["http://example.com:8080/", "http://127.0.0.1/"])("refuses %s", async (target) => {
    const proxy = new URL(await egressProxyUrl());
    const status = await new Promise<string>((resolve, reject) => {
      const socket = net.connect(Number(proxy.port), proxy.hostname, () => {
        const credentials = Buffer.from(`${proxy.username}:${proxy.password}`).toString("base64");
        socket.write(`GET ${target} HTTP/1.1\r\nHost: x\r\nProxy-Authorization: Basic ${credentials}\r\nConnection: close\r\n\r\n`);
      });
      socket.once("data", (data) => {
        resolve(data.toString().split("\r\n")[0] ?? "");
        socket.destroy();
      });
      socket.on("error", reject);
    });
    expect(status).toContain("403");
  });
});
