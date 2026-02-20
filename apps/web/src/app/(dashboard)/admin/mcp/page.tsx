"use client";

import { useState, useEffect } from "react";
import { Button } from "@basicsos/ui";

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
  const [copied, setCopied] = useState(false);

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

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(SETUP_INSTRUCTIONS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">MCP Server</h1>
        <p className="mt-1 text-sm text-stone-500">
          Connect AI tools to your company data via the Model Context Protocol.
        </p>
      </div>

      {/* Status card */}
      <div className="mb-6 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-stone-900">Server Status</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                status === "checking"
                  ? "bg-stone-300 animate-pulse"
                  : status === "healthy"
                    ? "bg-green-500"
                    : "bg-red-400"
              }`}
            />
            <span className="text-sm font-medium text-stone-700">
              {status === "checking"
                ? "Checking…"
                : status === "healthy"
                  ? "Healthy"
                  : "Unreachable"}
            </span>
          </div>
          <code className="rounded bg-stone-50 px-2 py-1 text-xs text-stone-700 border border-stone-200">
            {mcpUrl}
          </code>
        </div>
        {status === "unreachable" && (
          <p className="mt-2 text-xs text-stone-400">
            Start the MCP server with:{" "}
            <code className="rounded bg-stone-50 px-1 text-xs">
              pnpm --filter @basicsos/mcp-company dev
            </code>
          </p>
        )}
      </div>

      {/* Config */}
      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Claude Desktop Config</h2>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-stone-100">
          {SETUP_INSTRUCTIONS}
        </pre>
        <ol className="mt-4 space-y-1 text-sm text-stone-500 list-decimal list-inside">
          <li>Open Claude Desktop → Settings → Developer → Edit Config</li>
          <li>Paste the JSON above</li>
          <li>Restart Claude Desktop</li>
          <li>Open a new conversation — Basics OS tools appear in the toolbar</li>
        </ol>
      </div>
    </div>
  );
};

export default AdminMCPPage;
