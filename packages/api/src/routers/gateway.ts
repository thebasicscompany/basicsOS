import { router, adminProcedure } from "../trpc.js";
import { getGatewayConfig } from "../lib/gateway-client.js";

/**
 * Gateway router — surfaces infra gateway config to the admin UI.
 * Admins can view the gateway URL + copy their API key for programmatic use.
 */
export const gatewayRouter = router({
  /**
   * Returns the gateway connection details.
   * The full key is returned (admin-only) so it can be copied from the UI.
   */
  getConfig: adminProcedure.query(() => getGatewayConfig()),
});
