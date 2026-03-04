import type { Context } from "hono";
import type { Db } from "../../../db/client.js";
import type { Env } from "../../../env.js";
export declare function createUpdateHandler(db: Db, env: Env): (c: Context) => Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 404, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 403, "json">) | (Response & import("hono").TypedResponse<{
    [x: string]: any;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
//# sourceMappingURL=update.d.ts.map