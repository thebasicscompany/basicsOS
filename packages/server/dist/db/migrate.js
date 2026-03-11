/**
 * Programmatic migration runner.
 * Run: DATABASE_URL=... pnpm exec tsx src/db/migrate.ts
 * Or use: pnpm db:push (for dev, pushes schema directly)
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { logger } from "@/lib/logger.js";
const log = logger.child({ component: "migrate" });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    log.error("DATABASE_URL is required");
    process.exit(1);
}
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);
async function run() {
    log.info("Running migrations...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    log.info("Migrations complete.");
    await sql.end();
}
run().catch((err) => {
    log.error({ err }, "Migration failed");
    process.exit(1);
});
