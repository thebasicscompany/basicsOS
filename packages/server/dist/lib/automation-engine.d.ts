import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
export interface WorkflowDefinition {
    nodes: Array<{
        id: string;
        type: string;
        position: {
            x: number;
            y: number;
        };
        data: Record<string, unknown>;
    }>;
    edges: Array<{
        id: string;
        source: string;
        target: string;
    }>;
}
export declare function startAutomationEngine(database: Db, environment: Env): Promise<void>;
export declare function reloadRule(ruleId: number): Promise<void>;
export declare function fireEvent(event: string, payload: Record<string, unknown>, crmUserId: number): Promise<void>;
/** Trigger a manual run for a specific rule. Sends job to run-automation queue. */
export declare function triggerRunNow(ruleId: number, crmUserId: number): Promise<boolean>;
//# sourceMappingURL=automation-engine.d.ts.map