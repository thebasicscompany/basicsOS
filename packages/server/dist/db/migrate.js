/**
 * Programmatic migration runner.
 * Run: DATABASE_URL=... pnpm exec tsx src/db/migrate.ts
 * Or use: pnpm db:push (for dev, pushes schema directly)
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { logger } from "../lib/logger.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const log = logger.child({ component: "migrate" });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    log.error("DATABASE_URL is required");
    process.exit(1);
}
// Suppress NOTICE messages (e.g. "already exists, skipping") - they can cause issues in some environments
const sql = postgres(connectionString, {
    max: 1,
    onnotice: () => { },
});
const db = drizzle(sql);
async function run() {
    log.info("Running migrations...");
    await migrate(db, {
        migrationsFolder: join(__dirname, "..", "..", "drizzle"),
    });
    log.info("Migrations complete.");
    await sql.end();
}
run().catch((err) => {
    log.error({
        err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
    }, "Migration failed");
    process.exit(1);
});
