import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index.js";

// Load root .env when running directly (seed, workers, tests).
// Two attempts: repo root relative to this file, and cwd (for drizzle-kit / tsx).
// dotenv.config is a no-op if the file doesn't exist, so this is always safe.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });
config({ path: path.resolve(process.cwd(), ".env") });

const connectionString = process.env["DATABASE_URL"];

// Defer the hard error to query time — the Pool is lazy and won't attempt a
// connection until a query is made, so module evaluation is safe without
// DATABASE_URL (e.g. during Next.js build-time static analysis).
const pool = new Pool({ connectionString: connectionString ?? "" });

if (!connectionString) {
  pool.on("error", () => {
    // swallow pool-level errors; per-query errors will surface naturally
  });
}

export const db = drizzle(pool, { schema });
export type DbConnection = typeof db;
