import { createStdioMCPServer } from "./transports/stdio.js";
import { createHttpMCPServer } from "./transports/http.js";

const startServer = async (): Promise<void> => {
  const mode = process.env["MCP_TRANSPORT"] ?? "stdio";
  if (mode === "http") {
    await createHttpMCPServer();
  } else {
    await createStdioMCPServer();
  }
};

startServer().catch(console.error);
