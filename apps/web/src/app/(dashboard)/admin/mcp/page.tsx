"use client";

import { useState, useEffect } from "react";
import { PageHeader, Card, CodeBlock, InlineCode } from "@basicsos/ui";

const mcpUrl = process.env["NEXT_PUBLIC_MCP_URL"] ?? "http://localhost:4000";

const SETUP_INSTRUCTIONS = `{
  "mcpServers": {
    "basicsos": {
      "command": "npx",
      "args": ["-y", "@basicsos/mcp-company"],
      "env": {
        "MCP_URL": "${mcpUrl}",
        "MCP_TENANT_ID": "<your-tenant-id>"
      }
    }
  }
}`;

// Next.js App Router requires default export — framework exception
const AdminMCPPage = (): JSX.Element => {
  const [status, setStatus] = useState<"checking" | "healthy" | "unreachable">("checking");

  useEffect(() => {
    const check = async (): Promise<void> => {
      try {
        const res = await fetch(`${mcpUrl}/health`, { signal: AbortSignal.timeout(3000) });
        setStatus(res.ok ? "healthy" : "unreachable");
      } catch {
        setStatus("unreachable");
      }
    };
    void check();
  }, []);

  return (
    <div>
      <PageHeader
        title="MCP Server"
        description="Connect AI tools to your company data via the Model Context Protocol."
        className="mb-6"
      />

      {/* Status card */}
      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-base font-semibold text-stone-900">Server Status</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                status === "checking"
                  ? "bg-stone-300 animate-pulse"
                  : status === "healthy"
                    ? "bg-success"
                    : "bg-destructive"
              }`}
            />
            <span className="text-sm font-medium text-stone-700">
              {status === "checking" ? "Checking\u2026" : status === "healthy" ? "Healthy" : "Unreachable"}
            </span>
          </div>
          <InlineCode>{mcpUrl}</InlineCode>
        </div>
        {status === "unreachable" && (
          <p className="mt-2 text-xs text-stone-500">
            Start the MCP server with:{" "}
            <InlineCode>pnpm --filter @basicsos/mcp-company dev</InlineCode>
          </p>
        )}
      </Card>

      {/* Config */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-stone-900">Claude Desktop Config</h2>
        <CodeBlock label="claude_desktop_config.json" code={SETUP_INSTRUCTIONS} />
        <ol className="mt-4 space-y-1 text-sm text-stone-500 list-decimal list-inside">
          <li>Open Claude Desktop &rarr; Settings &rarr; Developer &rarr; Edit Config</li>
          <li>Paste the JSON above</li>
          <li>Restart Claude Desktop</li>
          <li>Open a new conversation — Basics OS tools appear in the toolbar</li>
        </ol>
      </Card>
    </div>
  );
};

export default AdminMCPPage;
