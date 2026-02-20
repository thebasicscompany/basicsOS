# MCP Servers

Basics OS exposes company data to AI tools (Claude, ChatGPT, Copilot) through two MCP servers built on the Model Context Protocol SDK v1.x.

## Company MCP Server (`apps/mcp/company`)

Connects AI tools to live company data by calling the tRPC `appRouter` directly via a server-side caller — no HTTP hop.

### Transports

- **stdio** (default): used when running as a subprocess of the AI tool (e.g., Claude Desktop)
- **HTTP** (Streamable): enabled via `MCP_TRANSPORT=http`; handles requests on `MCP_PORT` (default 4000) using `StreamableHTTPServerTransport`

### Tools

| Tool                    | Description                               | tRPC endpoint                                                      |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `search_knowledge_base` | Full-text search over knowledge documents | `knowledge.search`                                                 |
| `query_crm`             | Search contacts, companies, and deals     | `crm.contacts.list`, `crm.companies.list`, `crm.deals.listByStage` |
| `list_tasks`            | List tasks filtered by status             | `tasks.list`                                                       |
| `search_meetings`       | Search meetings by title                  | `meetings.search`                                                  |

### Auth model (Phase 1)

The server uses a system caller context (`userId: "system"`, `role: "admin"`). Tenant is resolved from `MCP_TENANT_ID` env var. Per-user RBAC will be added in a later phase.

### Key files

- `src/index.ts` — entry point, selects transport from `MCP_TRANSPORT`
- `src/server.ts` — creates `McpServer` and registers all tools
- `src/caller.ts` — `createSystemCaller(tenantId)` returns a tRPC caller with system context
- `src/tools/` — one file per tool, each exports a `registerXxxTool(server)` function
- `src/transports/` — `stdio.ts` and `http.ts`

## Engineer MCP Server (`apps/mcp/engineer`)

Reserved for AI-powered engineer tooling (code search, PR review, etc.). Not yet implemented.
