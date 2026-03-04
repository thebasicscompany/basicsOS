import type { Context } from "hono";
import type { Db } from "../../../db/client.js";
export declare function createListHandler(db: Db): (c: Context) => Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 404, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 403, "json">) | (Response & import("hono").TypedResponse<{
    [x: string]: any;
}[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
//# sourceMappingURL=list.d.ts.map