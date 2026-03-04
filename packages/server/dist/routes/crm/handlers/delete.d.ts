import type { Context } from "hono";
import type { Db } from "../../../db/client.js";
export declare function createDeleteHandler(db: Db): (c: Context) => Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 404, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 403, "json">) | (Response & import("hono").TypedResponse<{
    archived: true;
    record: {
        id: number;
        name: string;
        companyId: number | null;
        contactIds: number[] | null;
        category: string | null;
        stage: string;
        description: string | null;
        amount: number | null;
        createdAt: string;
        updatedAt: string;
        archivedAt: string | null;
        expectedClosingDate: string | null;
        crmUserId: number | null;
        organizationId: string | null;
        index: number | null;
        customFields: {
            [x: string]: import("hono/utils/types").JSONValue;
        };
    };
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    [x: string]: any;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
//# sourceMappingURL=delete.d.ts.map