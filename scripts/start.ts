import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "../src/core/env.ts";
import { createLogger } from "../src/core/log/index.ts";
import { installClientIpHeader } from "../src/core/security/client-ip.ts";
import { settingsError } from "../src/core/settings.ts";
import { runMigrations } from "./db-migrate.ts";

const here = import.meta.dirname;
const bundled = fs.existsSync(path.join(here, "server.js"));
const root = bundled ? here : path.resolve(here, "..");
const server = bundled ? path.join(here, "server.js") : path.join(root, ".next", "standalone", "server.js");

if (import.meta.main || bundled) {
  const log = createLogger("start");
  const problem = settingsError(process.env, process.cwd());
  if (problem) {
    log.error(problem);
    process.exit(1);
  }
  const { dataDir } = parseEnv(process.env, process.cwd());
  process.env.DATA_DIR = dataDir;
  runMigrations(dataDir, path.join(root, "drizzle"));
  log.info("Database ready", { dataDir });
  installClientIpHeader(http);
  await import(pathToFileURL(server).href);
}
