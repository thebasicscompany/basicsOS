import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import type { WorkflowDefinition } from "../lib/automation-engine.js";
type CrmUserRow = {
    id: number;
    organizationId?: string | null;
    userId?: string;
};
export declare function executeWorkflow(workflowDef: WorkflowDefinition, triggerData: Record<string, unknown>, crmUser: CrmUserRow, db: Db, env: Env): Promise<Record<string, unknown>>;
export {};
//# sourceMappingURL=automation-executor.d.ts.map