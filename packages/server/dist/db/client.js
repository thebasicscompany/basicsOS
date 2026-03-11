import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema/index.js";
export function createDb(connectionString) {
    const sql = postgres(connectionString, { max: 10 });
    const db = drizzle(sql, { schema });
    return { db, close: () => sql.end({ timeout: 5 }) };
}
