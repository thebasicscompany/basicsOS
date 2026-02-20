/**
 * Applies RLS policies from rls.sql after every migration.
 * Idempotent — safe to run multiple times.
 * Called automatically by `bun db:migrate`.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../../../.env") });
config({ path: path.resolve(process.cwd(), ".env") });

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  console.error("❌ DATABASE_URL is not set — cannot apply RLS policies");
  process.exit(1);
}

const sql = readFileSync(join(__dirname, "rls.sql"), "utf8");

const client = new Client({ connectionString: databaseUrl });

await client.connect();
try {
  await client.query(sql);
  console.log("✅ RLS policies applied");
} finally {
  await client.end();
}
