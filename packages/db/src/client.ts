import { config } from "dotenv";
import path from "path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index";

// Load root .env when running directly (seed, workers, tests).
// This file compiles to CommonJS so __dirname is available as a global.
// Two attempts: repo root relative to this file, and cwd (for drizzle-kit / tsx).
// dotenv.config is a no-op if the file doesn't exist, so this is always safe.
config({ path: path.resolve(__dirname, "../../../.env") });
config({ path: path.resolve(process.cwd(), ".env") });

const connectionString = process.env["DATABASE_URL"];

// Defer the hard error to query time — the Pool is lazy and won't attempt a
// connection until a query is made, so module evaluation is safe without
// DATABASE_URL (e.g. during Next.js build-time static analysis).
const pool = new Pool({
  connectionString: connectionString ?? "",
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

if (!connectionString) {
  pool.on("error", (err) => {
    console.error("[db] Pool error (no DATABASE_URL configured):", err.message);
  });
} else {
  pool.on("error", (err) => {
    console.error("[db] Unexpected pool error:", err.message);
  });
}

export const db = drizzle(pool, { schema });
export type DbConnection = typeof db;
