import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createSystemCaller } from "../caller.js";

export const registerQueryCrmTool = (server: McpServer): void => {
  server.tool(
    "query_crm",
    "Search CRM contacts, companies, and deals",
    {
      query: z.string().describe("Search query"),
      type: z
        .enum(["contacts", "companies", "deals", "all"])
        .describe("Type of CRM data to search"),
    },
    { readOnlyHint: true },
    async ({ query, type }) => {
      const tenantId = process.env["MCP_TENANT_ID"] ?? "";
      if (!tenantId) {
        return {
          content: [{ type: "text" as const, text: "Error: MCP_TENANT_ID not configured" }],
        };
      }
      try {
        const caller = createSystemCaller(tenantId);
        const lines: string[] = [];

        if (type === "contacts" || type === "all") {
          const contacts = await caller.crm.contacts.list({ search: query, limit: 20 });
          if (contacts.length > 0) {
            lines.push("## Contacts");
            for (const c of contacts) {
              lines.push(`- ${c.name}${c.email ? ` <${c.email}>` : ""} (ID: ${c.id})`);
            }
          }
        }

        if (type === "companies" || type === "all") {
          const companies = await caller.crm.companies.list();
          const filtered = companies.filter(
            (c) =>
              c.name.toLowerCase().includes(query.toLowerCase()) ||
              (c.domain ?? "").toLowerCase().includes(query.toLowerCase()),
          );
          if (filtered.length > 0) {
            lines.push("## Companies");
            for (const c of filtered) {
              lines.push(`- ${c.name}${c.domain ? ` (${c.domain})` : ""} (ID: ${c.id})`);
            }
          }
        }

        if (type === "deals" || type === "all") {
          const stageGroups = await caller.crm.deals.listByStage();
          const matchingDeals = stageGroups.flatMap((g) =>
            g.deals.filter((d) => d.title.toLowerCase().includes(query.toLowerCase())),
          );
          if (matchingDeals.length > 0) {
            lines.push("## Deals");
            for (const d of matchingDeals) {
              lines.push(`- ${d.title} [${d.stage}] value: ${d.value} (ID: ${d.id})`);
            }
          }
        }

        const text = lines.length === 0 ? "No CRM records found." : lines.join("\n");
        return { content: [{ type: "text" as const, text }] };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
      }
    },
  );
};
