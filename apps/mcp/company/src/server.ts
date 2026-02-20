import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchKnowledgeTool } from "./tools/search-knowledge.js";
import { registerQueryCrmTool } from "./tools/query-crm.js";
import { registerManageTasksTool } from "./tools/manage-tasks.js";
import { registerSearchMeetingsTool } from "./tools/search-meetings.js";
import { registerWriteKnowledgeTools } from "./tools/write-knowledge.js";
import { registerWriteTasksTools } from "./tools/write-tasks.js";
import { registerWriteCrmTools } from "./tools/write-crm.js";

export const createMCPServer = (): McpServer => {
  const server = new McpServer({
    name: "Basics OS Company MCP Server",
    version: "1.0.0",
  });

  // Read tools
  registerSearchKnowledgeTool(server);
  registerQueryCrmTool(server);
  registerManageTasksTool(server);
  registerSearchMeetingsTool(server);

  // Write tools
  registerWriteKnowledgeTools(server);
  registerWriteTasksTools(server);
  registerWriteCrmTools(server);

  return server;
};
