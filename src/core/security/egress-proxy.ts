import { randomBytes } from "node:crypto";
import dns from "node:dns";
import http from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import { isBlockedAddress } from "./safe-fetch";

type ProxyState = { url: Promise<string> };

const globalKey = Symbol.for("holdall.egressProxy");
const store = globalThis as unknown as Record<symbol, ProxyState | undefined>;

async function publicAddress(host: string): Promise<{ address: string; family: number }> {
  const plain = host.replace(/^\[|\]$/g, "");
  const candidates = net.isIP(plain) ? [{ address: plain, family: net.isIP(plain) }] : await dns.promises.lookup(plain, { all: true });
  const allowed = candidates.find((entry) => !isBlockedAddress(entry.address));
  if (!allowed) throw new Error(`${host} is a private or internal address.`);
  return allowed;
}

function authorized(request: http.IncomingMessage, secret: string): boolean {
  const header = request.headers["proxy-authorization"];
  return header === `Basic ${Buffer.from(`holdall:${secret}`).toString("base64")}`;
}

function start(): Promise<string> {
  const secret = randomBytes(24).toString("hex");
  const server = http.createServer(async (request, response) => {
    if (!authorized(request, secret)) {
      response.writeHead(407, { "Proxy-Authenticate": "Basic" }).end();
      return;
    }
    try {
      const target = new URL(request.url ?? "");
      if (target.protocol !== "http:") throw new Error("Only http is forwarded without CONNECT.");
      const { address, family } = await publicAddress(target.hostname);
      const headers = { ...request.headers };
      delete headers["proxy-authorization"];
      delete headers["proxy-connection"];
      const upstream = http.request(
        { host: address, family, port: target.port || 80, method: request.method, path: target.pathname + target.search, headers: { ...headers, host: target.host } },
        (reply) => {
          response.writeHead(reply.statusCode ?? 502, reply.headers);
          reply.pipe(response);
        },
      );
      upstream.on("error", () => response.writeHead(502).end());
      request.pipe(upstream);
    } catch {
      response.writeHead(403).end();
    }
  });
  server.on("connect", async (request, socket, head) => {
    socket.on("error", () => socket.destroy());
    if (!authorized(request, secret)) {
      socket.end("HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic\r\n\r\n");
      return;
    }
    const [host, portText] = (request.url ?? "").split(/:(?=\d+$)/);
    const port = Number(portText);
    if (!host || !port || (port !== 443 && port !== 80)) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    try {
      const { address } = await publicAddress(host);
      const upstream = net.connect(port, address, () => {
        socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        upstream.pipe(socket);
        socket.pipe(upstream);
      });
      upstream.on("error", () => socket.destroy());
    } catch {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    }
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.unref();
      const { port } = server.address() as AddressInfo;
      resolve(`http://holdall:${secret}@127.0.0.1:${port}`);
    });
  });
}

export function egressProxyUrl(): Promise<string> {
  const state = (store[globalKey] ??= { url: start() });
  return state.url;
}
