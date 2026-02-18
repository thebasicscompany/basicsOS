import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMCPServer } from "../server.js";

export const createStdioMCPServer = async (): Promise<void> => {
  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Basics OS MCP Server running on stdio\n");
};
