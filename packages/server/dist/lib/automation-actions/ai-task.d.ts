export type AiTaskResult = {
    result: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        model: string;
    };
};
export declare function executeAI(config: Record<string, unknown>, _context: Record<string, unknown>, apiKey: string, env: {
    BASICSOS_API_URL: string;
}): Promise<AiTaskResult>;
//# sourceMappingURL=ai-task.d.ts.map