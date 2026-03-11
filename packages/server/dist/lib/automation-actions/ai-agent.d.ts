import type { Db } from "@/db/client.js";
export type AiAgentResult = {
    ai_agent_result: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        model: string;
    };
};
export declare function executeAIAgent(config: Record<string, unknown>, _context: Record<string, unknown>, db: Db, crmUserId: number, apiKey: string, env: {
    BASICSOS_API_URL: string;
}): Promise<AiAgentResult>;
//# sourceMappingURL=ai-agent.d.ts.map