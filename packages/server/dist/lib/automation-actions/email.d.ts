export type EmailResult = {
    emailsSent: number;
};
export declare function executeEmail(config: Record<string, unknown>, _context: Record<string, unknown>, apiKey: string, env: {
    BASICSOS_API_URL: string;
}): Promise<EmailResult>;
//# sourceMappingURL=email.d.ts.map