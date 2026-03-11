import type { Context } from "hono";
import type { Db } from "../../../db/client.js";
import type { Env } from "../../../env.js";
export declare function createCreateHandler(db: Db, env: Env): (c: Context) => Promise<Response>;
//# sourceMappingURL=create.d.ts.map