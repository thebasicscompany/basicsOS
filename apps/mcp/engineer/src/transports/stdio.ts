import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createEngineerMCPServer } from "../server.js";

export const createStdioEngineerServer = async (): Promise<void> => {
  const server = createEngineerMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Basics OS Engineer MCP Server running on stdio\n");
};
