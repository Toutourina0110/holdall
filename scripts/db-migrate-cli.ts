import path from "node:path";
import { getEnv } from "../src/core/env.ts";
import { createLogger } from "../src/core/log/index.ts";
import { runMigrations } from "./db-migrate.ts";

const { dataDir } = getEnv();
runMigrations(dataDir);
createLogger("db").info("Migrations applied", { database: path.join(dataDir, "holdall.db") });
