import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema/index.js";

export function createDb(connectionString: string) {
  const sql = postgres(connectionString, { max: 10 });
  const db = drizzle(sql, { schema });
  // `sql` (the raw postgres.js client) is exposed for the app-module ScopedDb,
  // which runs guarded parameterized queries via sql.unsafe(query, params).
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

export type Db = ReturnType<typeof createDb>["db"];
export type RawSql = ReturnType<typeof createDb>["sql"];
