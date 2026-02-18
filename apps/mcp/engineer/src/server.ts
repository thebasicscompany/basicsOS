import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTeamContextResource } from "./resources/team-context.js";
import { registerClaudeMdResource } from "./resources/claude-md.js";
import { registerSkillsResource } from "./resources/skills.js";

export const createEngineerMCPServer = (): McpServer => {
  const server = new McpServer({
    name: "Basics OS Engineer MCP Server",
    version: "1.0.0",
  });

  registerTeamContextResource(server);
  registerClaudeMdResource(server);
  registerSkillsResource(server);

  return server;
};
