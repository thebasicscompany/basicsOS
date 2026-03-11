import type { Context } from "hono";
import type { Db } from "../../../db/client.js";
import type { Env } from "../../../env.js";
export declare function createUpdateHandler(db: Db, env: Env): (c: Context) => Promise<Response>;
//# sourceMappingURL=update.d.ts.map