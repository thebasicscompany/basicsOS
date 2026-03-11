import { Hono } from "hono";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
type Auth = ReturnType<typeof createAuth>;
export declare function createConnectionsRoutes(db: Db, auth: Auth, env: Env): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export {};
//# sourceMappingURL=connections.d.ts.map