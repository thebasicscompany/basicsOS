import type { Db } from "@/db/client.js";
import { type HybridSearchContext } from "@/lib/resolve-by-name.js";
export declare const ASSISTANT_TOOLS: ({
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                query: {
                    type: string;
                    description: string;
                };
                id?: undefined;
                contact_name?: undefined;
                first_name?: undefined;
                last_name?: undefined;
                email?: undefined;
                company_id?: undefined;
                company_name?: undefined;
                name?: undefined;
                category?: undefined;
                domain?: undefined;
                description?: undefined;
                status?: undefined;
                amount?: undefined;
                deal_id?: undefined;
                deal_name?: undefined;
                contact_id?: undefined;
                text?: undefined;
                type?: undefined;
                due_date?: undefined;
            };
            required: never[];
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
                id: {
                    type: string;
                    description: string;
                };
                contact_name: {
                    type: string;
                    description: string;
                };
                query?: undefined;
                first_name?: undefined;
                last_name?: undefined;
                email?: undefined;
                company_id?: undefined;
                company_name?: undefined;
                name?: undefined;
                category?: undefined;
                domain?: undefined;
                description?: undefined;
                status?: undefined;
                amount?: undefined;
                deal_id?: undefined;
                deal_name?: undefined;
                contact_id?: undefined;
                text?: undefined;
                type?: undefined;
                due_date?: undefined;
            };
            required: never[];
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
                first_name: {
                    type: string;
                    description: string;
                };
                last_name: {
                    type: string;
                    description: string;
                };
                email: {
                    type: string;
                    description: string;
                };
                company_id: {
                    type: string;
                    description: string;
                };
                company_name: {
                    type: string;
                    description: string;
                };
                query?: undefined;
                id?: undefined;
                contact_name?: undefined;
                name?: undefined;
                category?: undefined;
                domain?: undefined;
                description?: undefined;
                status?: undefined;
                amount?: undefined;
                deal_id?: undefined;
                deal_name?: undefined;
                contact_id?: undefined;
                text?: undefined;
                type?: undefined;
                due_date?: undefined;
            };
            required: never[];
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
                id: {
                    type: string;
                    description: string;
                };
                contact_name: {
                    type: string;
                    description: string;
                };
                first_name: {
                    type: string;
                    description: string;
                };
                last_name: {
                    type: string;
                    description: string;
                };
                email: {
                    type: string;
                    description: string;
                };
                query?: undefined;
                company_id?: undefined;
                company_name?: undefined;
                name?: undefined;
                category?: undefined;
                domain?: undefined;
                description?: undefined;
                status?: undefined;
                amount?: undefined;
                deal_id?: undefined;
                deal_name?: undefined;
                contact_id?: undefined;
                text?: undefined;
                type?: undefined;
                due_date?: undefined;
            };
            required: never[];
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
                name: {
                    type: string;
                    description: string;
                };
                category: {
                    type: string;
                    description: string;
                };
                domain: {
                    type: string;
                    description: string;
                };
                query?: undefined;
                id?: undefined;
                contact_name?: undefined;
                first_name?: undefined;
                last_name?: undefined;
                email?: undefined;
                company_id?: undefined;
                company_name?: undefined;
                description?: undefined;
                status?: undefined;
                amount?: undefined;
                deal_id?: undefined;
                deal_name?: undefined;
                contact_id?: undefined;
                text?: undefined;
                type?: undefined;
                due_date?: undefined;
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
                id: {
                    type: string;
                    description: string;
                };
                company_name: {
                    type: string;
                    description: string;
                };
                name: {
                    type: string;
                    description: string;
                };
                category: {
                    type: string;
                    description: string;
                };
                domain: {
                    type: string;
                    description: string;
                };
                description: {
                    type: string;
                    description: string;
                };
                query?: undefined;
                contact_name?: undefined;
                first_name?: undefined;
                last_name?: undefined;
                email?: undefined;
                company_id?: undefined;
                status?: undefined;
                amount?: undefined;
                deal_id?: undefined;
                deal_name?: undefined;
                contact_id?: undefined;
                text?: undefined;
                type?: undefined;
                due_date?: undefined;
            };
            required: never[];
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
                query: {
                    type: string;
                    description: string;
                };
                status: {
                    type: string;
                    description: string;
                };
                id?: undefined;
                contact_name?: undefined;
                first_name?: undefined;
                last_name?: undefined;
                email?: undefined;
                company_id?: undefined;
                company_name?: undefined;
                name?: undefined;
                category?: undefined;
                domain?: undefined;
                description?: undefined;
                amount?: undefined;
                deal_id?: undefined;
                deal_name?: undefined;
                contact_id?: undefined;
                text?: undefined;
                type?: undefined;
                due_date?: undefined;
            };
            required: never[];
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
                name: {
                    type: string;
                    description: string;
                };
                status: {
                    type: string;
                    description: string;
                };
                company_id: {
                    type: string;
                    description: string;
                };
                company_name: {
                    type: string;
                    description: string;
                };
                amount: {
                    type: string;
                    description: string;
                };
                query?: undefined;
                id?: undefined;
                contact_name?: undefined;
                first_name?: undefined;
                last_name?: undefined;
                email?: undefined;
                category?: undefined;
                domain?: undefined;
                description?: undefined;
                deal_id?: undefined;
                deal_name?: undefined;
                contact_id?: undefined;
                text?: undefined;
                type?: undefined;
                due_date?: undefined;
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
                deal_name: {
                    type: string;
                    description: string;
                };
                name: {
                    type: string;
                    description: string;
                };
                status: {
                    type: string;
                    description: string;
                };
                amount: {
                    type: string;
                    description: string;
                };
                query?: undefined;
                id?: undefined;
                contact_name?: undefined;
                first_name?: undefined;
                last_name?: undefined;
                email?: undefined;
                company_id?: undefined;
                company_name?: undefined;
                category?: undefined;
                domain?: undefined;
                description?: undefined;
                contact_id?: undefined;
                text?: undefined;
                type?: undefined;
                due_date?: undefined;
            };
            required: never[];
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
                contact_name: {
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
                query?: undefined;
                id?: undefined;
                first_name?: undefined;
                last_name?: undefined;
                email?: undefined;
                company_id?: undefined;
                company_name?: undefined;
                name?: undefined;
                category?: undefined;
                domain?: undefined;
                description?: undefined;
                status?: undefined;
                amount?: undefined;
                deal_id?: undefined;
                deal_name?: undefined;
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
                contact_name: {
                    type: string;
                    description: string;
                };
                deal_id: {
                    type: string;
                    description: string;
                };
                deal_name: {
                    type: string;
                    description: string;
                };
                text: {
                    type: string;
                    description: string;
                };
                query?: undefined;
                id?: undefined;
                first_name?: undefined;
                last_name?: undefined;
                email?: undefined;
                company_id?: undefined;
                company_name?: undefined;
                name?: undefined;
                category?: undefined;
                domain?: undefined;
                description?: undefined;
                status?: undefined;
                amount?: undefined;
                type?: undefined;
                due_date?: undefined;
            };
            required: string[];
        };
    };
})[];
export declare function executeAssistantToolDrizzle(db: Db, crmUserId: number, organizationId: string, toolName: string, args: Record<string, unknown>, searchContext?: HybridSearchContext): Promise<string>;
//# sourceMappingURL=tools.d.ts.map