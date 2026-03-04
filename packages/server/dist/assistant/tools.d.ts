import type { Db } from "../db/client.js";
export declare const ASSISTANT_TOOLS: ({
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                contact_id: {
                    type: string;
                    description: string;
                };
                text: {
                    type: string;
                    description: string;
                };
                type: {
                    type: string;
                    description: string;
                    default: string;
                };
                due_date: {
                    type: string;
                    description: string;
                };
                deal_id?: undefined;
                stage?: undefined;
            };
            required: string[];
        };
    };
} | {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                contact_id: {
                    type: string;
                    description: string;
                };
                deal_id: {
                    type: string;
                    description: string;
                };
                text: {
                    type: string;
                    description: string;
                };
                type?: undefined;
                due_date?: undefined;
                stage?: undefined;
            };
            required: string[];
        };
    };
} | {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                deal_id: {
                    type: string;
                    description: string;
                };
                stage: {
                    type: string;
                    description: string;
                };
                contact_id?: undefined;
                text?: undefined;
                type?: undefined;
                due_date?: undefined;
            };
            required: string[];
        };
    };
})[];
export declare function executeAssistantToolDrizzle(db: Db, crmUserId: number, organizationId: string, toolName: string, args: Record<string, unknown>): Promise<string>;
//# sourceMappingURL=tools.d.ts.map