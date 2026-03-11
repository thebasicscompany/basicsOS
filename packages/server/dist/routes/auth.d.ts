import { Hono } from "hono";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
export declare function createAuthRoutes(db: Db, auth: ReturnType<typeof createAuth>, env: Env): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=auth.d.ts.map