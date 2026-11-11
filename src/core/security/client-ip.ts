import type * as Http from "node:http";

export const clientIpHeader = "x-holdall-client-ip";

export function installClientIpHeader(http: typeof Http): () => void {
  const prototype = http.Server.prototype;
  const original = prototype.emit;
  prototype.emit = function emit(this: Http.Server, event: string | symbol, ...args: unknown[]) {
    if (event === "request") {
      const request = args[0] as Http.IncomingMessage;
      request.headers[clientIpHeader] = request.socket.remoteAddress ?? "";
    }
    return original.call(this, event, ...args);
  } as typeof prototype.emit;
  return () => {
    prototype.emit = original;
  };
}

export function clientIpOf(headers: Headers, trustProxy: boolean): string {
  if (!trustProxy) return headers.get(clientIpHeader) ?? "";
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "";
}
