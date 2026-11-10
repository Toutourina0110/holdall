import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { LookupFunction } from "node:net";
import { UserFacingError } from "@/core/errors";

const blockedV4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function v4ToNumber(address: string): number {
  return address.split(".").reduce((total, part) => total * 256 + Number(part), 0);
}

export function isBlockedAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedAddress(mapped[1]!);
  if (net.isIPv4(address)) {
    const value = v4ToNumber(address);
    return blockedV4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (value & mask) >>> 0 === (v4ToNumber(base) & mask) >>> 0;
    });
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    return lower === "::" || lower === "::1" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || /^ff/.test(lower);
  }
  return true;
}

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    const list = addresses as dns.LookupAddress[];
    const blocked = list.find((entry) => isBlockedAddress(entry.address));
    if (blocked || list.length === 0) {
      return callback(Object.assign(new Error(`${hostname} resolves to a private or internal address.`), { code: "EBLOCKED" }), "", 4);
    }
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

export type SafeResponse = { status: number; headers: Record<string, string>; body: Buffer };

export async function safeFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; maxBytes?: number; timeoutMs?: number; allowHttp?: boolean; redirects?: number } = {},
): Promise<SafeResponse> {
  const target = new URL(url);
  if (target.protocol !== "https:" && !(options.allowHttp && target.protocol === "http:")) {
    throw new UserFacingError("Only https addresses are allowed.");
  }
  if (net.isIP(target.hostname.replace(/^\[|\]$/g, "")) && isBlockedAddress(target.hostname.replace(/^\[|\]$/g, ""))) {
    throw new UserFacingError(`${target.hostname} is a private or internal address.`);
  }
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const client = target.protocol === "https:" ? https : http;
  const response = await new Promise<SafeResponse & { location?: string }>((resolve, reject) => {
    const request = client.request(
      target,
      { method: options.method ?? "GET", headers: options.headers, lookup: guardedLookup, timeout: options.timeoutMs ?? 15000 },
      (incoming) => {
        const declared = Number(incoming.headers["content-length"] ?? 0);
        if (declared > maxBytes) {
          incoming.destroy();
          reject(new UserFacingError(`The response is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on("data", (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > maxBytes) {
            incoming.destroy();
            reject(new UserFacingError(`The response is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`));
            return;
          }
          chunks.push(chunk);
        });
        incoming.on("end", () =>
          resolve({
            status: incoming.statusCode ?? 0,
            headers: Object.fromEntries(Object.entries(incoming.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value ?? "")])),
            body: Buffer.concat(chunks),
            location: incoming.headers.location,
          }),
        );
        incoming.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new UserFacingError("The remote server took too long to answer.")));
    request.on("error", (error: Error & { code?: string }) =>
      reject(error.code === "EBLOCKED" ? new UserFacingError(error.message) : error instanceof UserFacingError ? error : new UserFacingError("The remote server could not be reached.")),
    );
    if (options.body) request.write(options.body);
    request.end();
  });
  const redirects = options.redirects ?? 0;
  if (response.status >= 300 && response.status < 400 && response.location) {
    if (redirects <= 0) throw new UserFacingError("The remote server answered with a redirect, which is not followed.");
    return safeFetch(new URL(response.location, target).toString(), { ...options, redirects: redirects - 1, method: "GET", body: undefined });
  }
  return { status: response.status, headers: response.headers, body: response.body };
}
