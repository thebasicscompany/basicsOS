import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createEngineerMCPServer } from "./server.js";

describe("createEngineerMCPServer", () => {
  it("returns a McpServer instance", () => {
    const server = createEngineerMCPServer();
    expect(server).toBeInstanceOf(McpServer);
  });
  // Resources are registered on creation — if server initializes without errors, resources are wired
  it("creates server without throwing", () => {
    expect(() => createEngineerMCPServer()).not.toThrow();
  });
});
