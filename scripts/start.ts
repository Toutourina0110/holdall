import path from "node:path";
import { pathToFileURL } from "node:url";
import { createLogger } from "../src/core/log/index.ts";
import { settingsError } from "../src/core/settings.ts";

if (import.meta.main) {
  const problem = settingsError(process.env, process.cwd());
  if (problem) {
    createLogger("start").error(problem);
    process.exit(1);
  }
  const server = path.resolve(import.meta.dirname, "..", ".next", "standalone", "server.js");
  await import(pathToFileURL(server).href);
}
