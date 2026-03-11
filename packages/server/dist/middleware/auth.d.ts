import type { Context, Next } from "hono";
import type { Db } from "@/db/client.js";
type AuthWithApi = {
    handler: (req: Request) => Promise<Response>;
    api: {
        getSession: (opts: {
            headers: Headers;
        }) => Promise<{
            user?: {
                id?: string;
            };
            session?: {
                id?: string;
                token?: string;
            };
        } | null>;
    };
};
/**
 * Supports both cookie-based auth (web) and Bearer token (pill overlay).
 * When the pill sends Authorization: Bearer <session_token>, we synthesize
 * the cookie so getSession can validate it.
 */
export declare function authMiddleware(auth: AuthWithApi, db: Db): (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 401, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 404, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 403, "json">) | undefined>;
export {};
//# sourceMappingURL=auth.d.ts.map