import postgres from "postgres";
import * as schema from "../db/schema/index.js";
export declare function createDb(connectionString: string): {
    db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
        $client: postgres.Sql<{}>;
    };
    close: () => Promise<void>;
};
export type Db = ReturnType<typeof createDb>["db"];
//# sourceMappingURL=client.d.ts.map