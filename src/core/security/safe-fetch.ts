import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import ipaddr from "ipaddr.js";
import type { LookupFunction } from "node:net";
import { UserFacingError } from "@/core/errors";

export function isBlockedAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return true;
  const parsed = ipaddr.process(address);
  if (parsed.kind() === "ipv6") {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.parts.slice(0, 6).every((part) => part === 0)) return true;
    const range = v6.range();
    if (range === "rfc6052" || range === "6to4") {
      const parts = range === "6to4" ? v6.parts.slice(1, 3) : v6.parts.slice(6, 8);
      const embedded = [parts[0]! >> 8, parts[0]! & 255, parts[1]! >> 8, parts[1]! & 255].join(".");
      return isBlockedAddress(embedded);
    }
  }
  return parsed.range() !== "unicast";
}

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    const allowed = (addresses as dns.LookupAddress[]).filter((entry) => !isBlockedAddress(entry.address));
    if (allowed.length === 0) {
      return callback(Object.assign(new Error(`${hostname} resolves to a private or internal address.`), { code: "EBLOCKED" }), "", 4);
    }
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, allowed);
    callback(null, allowed[0]!.address, allowed[0]!.family);
  });
};

export type SafeResponse = { status: number; headers: Record<string, string>; body: Buffer };

export async function safeFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; maxBytes?: number; timeoutMs?: number; allowHttp?: boolean; redirects?: number; manualRedirect?: boolean } = {},
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
    const deadline = setTimeout(() => request.destroy(new UserFacingError("The remote server took too long to answer.")), options.timeoutMs ?? 15000);
    request.on("close", () => clearTimeout(deadline));
    request.on("timeout", () => request.destroy(new UserFacingError("The remote server took too long to answer.")));
    request.on("error", (error: Error & { code?: string }) =>
      reject(error.code === "EBLOCKED" ? new UserFacingError(error.message) : error instanceof UserFacingError ? error : new UserFacingError("The remote server could not be reached.")),
    );
    if (options.body) request.write(options.body);
    request.end();
  });
  const redirects = options.redirects ?? 0;
  if (response.status >= 300 && response.status < 400 && response.location && !options.manualRedirect) {
    if (redirects <= 0) throw new UserFacingError("The remote server answered with a redirect, which is not followed.");
    return safeFetch(new URL(response.location, target).toString(), { ...options, redirects: redirects - 1, method: "GET", body: undefined });
  }
  return { status: response.status, headers: response.headers, body: response.body };
}

export async function assertPublicUrl(value: string): Promise<void> {
  const host = new URL(value).hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new UserFacingError(`${host} is a private or internal address.`);
    return;
  }
  const addresses = await dns.promises.lookup(host, { all: true }).catch(() => {
    throw new UserFacingError(`${host} could not be found. Check the link.`);
  });
  if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new UserFacingError(`${host} points to a private or internal address. Only public websites can be downloaded.`);
  }
}
