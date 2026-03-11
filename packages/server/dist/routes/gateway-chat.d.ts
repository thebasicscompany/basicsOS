import { Hono } from "hono";
import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import type { createAuth } from "../auth.js";
import type * as schema from "../db/schema/index.js";
type BetterAuthInstance = ReturnType<typeof createAuth>;
export type ProcessChatTurnParams = {
    crmUser: typeof schema.crmUsers.$inferSelect;
    gatewayHeaders: Record<string, string>;
    gatewayUrl: string;
    messages: unknown[];
    threadId?: string;
    channel?: "chat" | "voice" | "automation";
};
export type ProcessChatTurnResult = {
    finalContent: string;
    threadId: string;
    usedTools: string[];
};
/** Shared chat turn logic used by both gateway-chat (UI) and stream-assistant (voice). */
export declare function processChatTurn(db: Db, env: Env, params: ProcessChatTurnParams): Promise<ProcessChatTurnResult>;
export declare function createGatewayChatRoutes(db: Db, auth: BetterAuthInstance, env: Env): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export {};
//# sourceMappingURL=gateway-chat.d.ts.map