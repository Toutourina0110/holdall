import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "../src/core/env.ts";
import { createLogger } from "../src/core/log/index.ts";
import { installClientIpHeader } from "../src/core/security/client-ip.ts";
import { settingsError } from "../src/core/settings.ts";
import { runMigrations } from "./db-migrate.ts";

if (import.meta.main) {
  const log = createLogger("start");
  const problem = settingsError(process.env, process.cwd());
  if (problem) {
    log.error(problem);
    process.exit(1);
  }
  const { dataDir } = parseEnv(process.env, process.cwd());
  process.env.DATA_DIR = dataDir;
  runMigrations(dataDir);
  log.info("Database ready", { dataDir });
  installClientIpHeader(http);
  const server = path.resolve(import.meta.dirname, "..", ".next", "standalone", "server.js");
  await import(pathToFileURL(server).href);
}
