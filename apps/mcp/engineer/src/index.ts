import { createStdioEngineerServer } from "./transports/stdio.js";
import { createHttpEngineerServer } from "./transports/http.js";

const startServer = async (): Promise<void> => {
  const mode = process.env["MCP_TRANSPORT"] ?? "stdio";
  if (mode === "http") {
    await createHttpEngineerServer();
  } else {
    await createStdioEngineerServer();
  }
};

startServer().catch(console.error);
