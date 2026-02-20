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

// Split out CONCURRENTLY statements — they cannot run inside a transaction block
// and must be executed as separate client.query() calls.
const concurrentlyStatements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => /CREATE INDEX CONCURRENTLY/i.test(s))
  .map((s) => s + ";");

const mainSql = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !/CREATE INDEX CONCURRENTLY/i.test(s))
  .join(";\n") + ";";

const client = new Client({ connectionString: databaseUrl });

await client.connect();
try {
  await client.query(mainSql);
  console.log("✅ RLS policies applied");

  for (const stmt of concurrentlyStatements) {
    await client.query(stmt);
  }
  if (concurrentlyStatements.length > 0) {
    console.log(`✅ ${concurrentlyStatements.length} HNSW vector index(es) applied`);
  }
} finally {
  await client.end();
}
