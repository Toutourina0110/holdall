import type * as Http from "node:http";

export const clientIpHeader = "x-holdall-client-ip";

export type ProxyHeader = "auto" | "cf-connecting-ip" | "x-real-ip" | "x-forwarded-for";

export type ProxyOptions = { trustProxy: boolean; header: ProxyHeader };

const noProxy: ProxyOptions = { trustProxy: false, header: "auto" };

function rightmost(value: string | undefined): string | undefined {
  return value?.split(",").at(-1)?.trim() || undefined;
}

export function proxiedClientIp(get: (name: string) => string | undefined, header: ProxyHeader): string | undefined {
  if (header === "x-forwarded-for") return rightmost(get("x-forwarded-for"));
  if (header !== "auto") return get(header)?.trim() || undefined;
  return get("cf-connecting-ip")?.trim() || get("x-real-ip")?.trim() || rightmost(get("x-forwarded-for"));
}

export function installClientIpHeader(http: typeof Http, options: ProxyOptions = noProxy): () => void {
  const prototype = http.Server.prototype;
  const original = prototype.emit;
  prototype.emit = function emit(this: Http.Server, event: string | symbol, ...args: unknown[]) {
    if (event === "request") {
      const request = args[0] as Http.IncomingMessage;
      const read = (name: string) => {
        const value = request.headers[name];
        return Array.isArray(value) ? value.join(",") : value;
      };
      const proxied = options.trustProxy ? proxiedClientIp(read, options.header) : undefined;
      request.headers[clientIpHeader] = proxied ?? request.socket.remoteAddress ?? "";
    }
    return original.call(this, event, ...args);
  } as typeof prototype.emit;
  return () => {
    prototype.emit = original;
  };
}

export function clientIpOf(headers: Headers, options: ProxyOptions): string {
  const installed = headers.get(clientIpHeader);
  if (installed) return installed;
  if (!options.trustProxy) return "";
  return proxiedClientIp((name) => headers.get(name) ?? undefined, options.header) ?? "";
}
