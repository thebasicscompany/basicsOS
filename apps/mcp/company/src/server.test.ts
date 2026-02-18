import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Mock @basicsos/db to avoid real database connections
vi.mock("@basicsos/db", () => ({
  db: {},
}));

// Mock @basicsos/api to avoid real connections
vi.mock("@basicsos/api", () => {
  const mockCaller = {
    knowledge: { search: vi.fn().mockResolvedValue([]) },
    crm: {
      contacts: { list: vi.fn().mockResolvedValue([]) },
      companies: { list: vi.fn().mockResolvedValue([]) },
      deals: { listByStage: vi.fn().mockResolvedValue([]) },
    },
    tasks: { list: vi.fn().mockResolvedValue([]) },
    meetings: { search: vi.fn().mockResolvedValue([]) },
  };
  return {
    appRouter: {
      createCaller: vi.fn().mockReturnValue(mockCaller),
    },
  };
});

// Mock worker / Redis dependencies pulled in transitively
vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock("better-auth", () => ({
  betterAuth: vi.fn().mockReturnValue({
    api: { getSession: vi.fn().mockResolvedValue(null) },
    handler: vi.fn(),
  }),
}));

type RegisteredTools = Record<string, { enabled: boolean }>;

const getRegisteredTools = (server: McpServer): RegisteredTools =>
  (server as unknown as { _registeredTools: RegisteredTools })["_registeredTools"];

describe("createMCPServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a McpServer instance", async () => {
    const { createMCPServer } = await import("./server.js");
    const server = createMCPServer();
    expect(server).toBeInstanceOf(McpServer);
  });

  it("registers the search_knowledge_base tool", async () => {
    const { createMCPServer } = await import("./server.js");
    const server = createMCPServer();
    const tools = getRegisteredTools(server);
    expect("search_knowledge_base" in tools).toBe(true);
  });

  it("registers the query_crm tool", async () => {
    const { createMCPServer } = await import("./server.js");
    const server = createMCPServer();
    const tools = getRegisteredTools(server);
    expect("query_crm" in tools).toBe(true);
  });

  it("registers the list_tasks tool", async () => {
    const { createMCPServer } = await import("./server.js");
    const server = createMCPServer();
    const tools = getRegisteredTools(server);
    expect("list_tasks" in tools).toBe(true);
  });

  it("registers the search_meetings tool", async () => {
    const { createMCPServer } = await import("./server.js");
    const server = createMCPServer();
    const tools = getRegisteredTools(server);
    expect("search_meetings" in tools).toBe(true);
  });

  it("registers exactly 4 tools", async () => {
    const { createMCPServer } = await import("./server.js");
    const server = createMCPServer();
    const tools = getRegisteredTools(server);
    expect(Object.keys(tools)).toHaveLength(4);
  });
});
