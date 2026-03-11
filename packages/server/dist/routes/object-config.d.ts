import { Hono } from "hono";
import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import type { createAuth } from "../auth.js";
type BetterAuthInstance = ReturnType<typeof createAuth>;
export declare function createObjectConfigRoutes(db: Db, auth: BetterAuthInstance, _env: Env): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export {};
//# sourceMappingURL=object-config.d.ts.map