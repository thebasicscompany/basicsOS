# Skill: Add a New MCP Tool

## When to Use

Exposing a tRPC procedure as a tool that AI assistants (Claude, ChatGPT, Copilot) can call.

## Tool File Template

```ts
// apps/mcp/company/src/tools/my-tool.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createSystemCaller } from "../caller.js";

export const registerMyTool = (server: McpServer): void => {
  server.tool(
    "my_tool_name", // snake_case, used by AI to call it
    "Clear description of what this tool does and when to use it",
    {
      // Input schema — what the AI must provide
      query: z.string().describe("What to search for"),
      limit: z.number().optional().describe("Maximum results (default: 10)"),
    },
    async ({ query, limit }) => {
      const tenantId = process.env["MCP_TENANT_ID"] ?? "";
      if (!tenantId) {
        return {
          content: [{ type: "text" as const, text: "Error: MCP_TENANT_ID not configured" }],
        };
      }

      try {
        const caller = createSystemCaller(tenantId);
        const results = await caller.myModule.search({ query, limit: limit ?? 10 });

        const text =
          results.length === 0
            ? "No results found."
            : results.map((r) => `- ${r.name} (ID: ${r.id})`).join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
      }
    },
  );
};
```

## Register in Server

Edit `apps/mcp/company/src/server.ts`:

```ts
import { registerMyTool } from "./tools/my-tool.js";

export const createMCPServer = (): McpServer => {
  const server = new McpServer({ name: "Basics OS Company MCP Server", version: "1.0.0" });
  // ...existing tools...
  registerMyTool(server); // add this line
  return server;
};
```

## Tool Naming Conventions

- Use `snake_case` for tool names: `search_knowledge_base`, `query_crm`, `list_tasks`
- Keep descriptions specific: "Search the company knowledge base for documents matching a query"
- Always describe input parameters with `.describe("...")`

## Return Format

Always return MCP-compatible content:

```ts
// Text response
return { content: [{ type: "text" as const, text: "Your response here" }] };

// Multiple content blocks
return {
  content: [
    { type: "text" as const, text: "Summary:" },
    { type: "text" as const, text: JSON.stringify(data, null, 2) },
  ],
};
```

## RBAC Considerations

The system caller uses `role: "admin"` by default. For viewer-safe tools:

- Don't expose write operations via MCP unless the PRD explicitly allows it
- Return read-only data from `protectedProcedure` routes only

## Testing the Tool

```bash
# Start the MCP server in stdio mode
MCP_TENANT_ID=<your-tenant-id> bun --filter @basicsos/mcp-company dev

# Or HTTP mode for testing with curl
MCP_TRANSPORT=http MCP_TENANT_ID=<id> bun --filter @basicsos/mcp-company dev
```

## Checklist

- [ ] Tool file created in `apps/mcp/company/src/tools/`
- [ ] Tool registered in `apps/mcp/company/src/server.ts`
- [ ] Input schema has `.describe()` on each field
- [ ] Error handling returns graceful text (not thrown exceptions)
- [ ] Tool name is snake_case and descriptive
- [ ] Return format uses `{ type: "text" as const, text: "..." }`
