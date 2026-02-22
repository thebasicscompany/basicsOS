import type { ActionHandler } from "./index.js";

/**
 * update_crm action — deferred implementation.
 * Returns a clear failure so the run history accurately reflects that no CRM
 * record was changed. Remove this stub when the action is implemented.
 */
export const updateCrmAction: ActionHandler = async (_config, _ctx) => ({
  status: "failed",
  output: null,
  error: "update_crm is not yet implemented",
});
