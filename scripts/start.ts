import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createLogger } from "../src/core/log/index.ts";
import { installClientIpHeader } from "../src/core/security/client-ip.ts";
import { settingsError } from "../src/core/settings.ts";

if (import.meta.main) {
  const problem = settingsError(process.env, process.cwd());
  if (problem) {
    createLogger("start").error(problem);
    process.exit(1);
  }
  installClientIpHeader(http);
  const server = path.resolve(import.meta.dirname, "..", ".next", "standalone", "server.js");
  await import(pathToFileURL(server).href);
}
