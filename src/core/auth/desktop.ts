import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/core/db/client";
import { user } from "@/core/db/schema";
import { getEnv } from "@/core/env";
import { countUsers, createFirstAdmin } from "./accounts";
import { getAuth } from "./server";

type LocalAccount = { email: string; password: string };

function accountFile(): string {
  return path.join(getEnv().dataDir, "desktop-account.json");
}

function readLocalAccount(): LocalAccount | undefined {
  try {
    return JSON.parse(fs.readFileSync(accountFile(), "utf8")) as LocalAccount;
  } catch {
    return undefined;
  }
}

export async function desktopSignIn(): Promise<Headers | undefined> {
  let account = readLocalAccount();
  if (countUsers() === 0) {
    account = { email: "you@holdall.local", password: randomBytes(32).toString("base64url") };
    fs.mkdirSync(path.dirname(accountFile()), { recursive: true });
    fs.writeFileSync(accountFile(), JSON.stringify(account), { mode: 0o600 });
    await createFirstAdmin({ name: "You", email: account.email, password: account.password });
  }
  if (!account || countUsers() !== 1) return undefined;
  const owner = getDb().select({ id: user.id }).from(user).where(eq(user.email, account.email)).get();
  if (!owner) return undefined;
  const result = await getAuth().api.signInEmail({ body: { email: account.email, password: account.password }, returnHeaders: true });
  return result.headers;
}
