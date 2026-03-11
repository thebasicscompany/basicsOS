import { Hono } from "hono";
import type { Db } from "../db/client.js";
import type { createAuth } from "../auth.js";
type BetterAuthInstance = ReturnType<typeof createAuth>;
export declare function createSchemaRoutes(db: Db, auth: BetterAuthInstance): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export {};
//# sourceMappingURL=schema.d.ts.map