import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Returns team context: sprint items, deployment status, roster
export const registerTeamContextResource = (server: McpServer): void => {
  server.resource(
    "team-context",
    "basicoseng://team/context",
    { mimeType: "application/json" },
    async () => {
      const tenantId = process.env["ENG_TENANT_ID"] ?? "";
      const context = {
        tenantId,
        sprint: { items: [], note: "Sprint data — configure via admin panel" },
        team: { roster: [], note: "Roster — populated from users table" },
        deployment: { status: "unknown", note: "Deployment status — configure CI/CD" },
      };
      return { contents: [{ uri: "basicoseng://team/context", mimeType: "application/json", text: JSON.stringify(context, null, 2) }] };
    },
  );
};
