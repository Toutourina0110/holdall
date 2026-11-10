import { sql } from "drizzle-orm";
import { getDb } from "@/core/db/client";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    getDb().run(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error", error: "Database is not reachable." }, { status: 503 });
  }
}
