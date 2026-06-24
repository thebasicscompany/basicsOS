import { useNavigate } from "react-router";
import { toast } from "sonner";
import { CopyIcon, ArrowSquareOutIcon } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getRuntimeApiUrl } from "@/lib/runtime-config";

/**
 * How an admin connects an external AI coding agent (Cursor / Claude Code / Codex)
 * to BasicsOS's build-time MCP server. The agent gets the org's objects + connectors
 * as context, builds an app, and deploys it — every deploy is AI-scanned and lands
 * as a DRAFT for a human to review + publish (agents never publish).
 */
export function ConnectCodingAgentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  // Must be an ABSOLUTE, externally-reachable URL for an MCP client. In prod
  // getRuntimeApiUrl() is the org's full server URL; in dev it's empty (relative +
  // vite proxy), so fall back to the current origin.
  const rawApiBase = getRuntimeApiUrl();
  const apiBase = /^https?:\/\//.test(rawApiBase)
    ? rawApiBase
    : typeof window !== "undefined"
      ? window.location.origin
      : rawApiBase;
  const mcpUrl = `${apiBase}/api/build-mcp`;
  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success(`Copied ${what}`);
  };

  const cursorConfig = `{
  "mcpServers": {
    "basicsos": {
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer bos_crm_YOUR_TOKEN" }
    }
  }
}`;
  const claudeCmd = `claude mcp add --transport http basicsos ${mcpUrl} \\
  --header "Authorization: Bearer bos_crm_YOUR_TOKEN"`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Build with your AI coding agent</DialogTitle>
          <DialogDescription>
            Connect Cursor, Claude Code, or Codex over MCP. The agent gets your objects + connectors
            as context, builds an app, and deploys it here as a <span className="font-medium text-foreground">draft</span>{" "}
            — every deploy is AI-scanned, and nothing goes live until a human publishes it.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-5 text-sm">
          {/* Step 1 — token */}
          <div className="space-y-1.5">
            <p className="font-medium">1. Create a build token</p>
            <p className="text-muted-foreground">
              The agent authenticates with a personal CRM API token (an admin token —{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">bos_crm_…</code>).
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate("/settings?section=crm-api-tokens#crm-api-tokens")}
            >
              <ArrowSquareOutIcon className="size-3.5" />
              Manage tokens in Settings
            </Button>
          </div>

          {/* Step 2 — MCP URL */}
          <div className="space-y-1.5">
            <p className="font-medium">2. MCP endpoint</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-muted px-2 py-1.5 text-xs">{mcpUrl}</code>
              <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => copy(mcpUrl, "URL")}>
                <CopyIcon className="size-4" />
              </Button>
            </div>
          </div>

          {/* Step 3 — connect */}
          <div className="space-y-2">
            <p className="font-medium">3. Add it to your agent</p>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Cursor — <code className="rounded bg-muted px-1 py-0.5">.cursor/mcp.json</code>:
              </p>
              <div className="relative">
                <pre className="whitespace-pre-wrap break-all rounded-md border border-border bg-muted/50 p-3 pr-9 text-xs">
                  {cursorConfig}
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1.5 top-1.5 size-7"
                  onClick={() => copy(cursorConfig, "Cursor config")}
                >
                  <CopyIcon className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Claude Code:</p>
              <div className="relative">
                <pre className="whitespace-pre-wrap break-all rounded-md border border-border bg-muted/50 p-3 pr-9 text-xs">
                  {claudeCmd}
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1.5 top-1.5 size-7"
                  onClick={() => copy(claudeCmd.replace(/\\\n\s*/g, " "), "command")}
                >
                  <CopyIcon className="size-3.5" />
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Codex / other MCP clients: add an HTTP MCP server with the same URL and{" "}
              <code className="rounded bg-muted px-1 py-0.5">Authorization: Bearer</code> header.
            </p>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Once connected, your agent has <code className="rounded bg-muted px-1 py-0.5">get_build_context</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5">deploy_app</code>, and{" "}
            <code className="rounded bg-muted px-1 py-0.5">list_apps</code>. There's no persistent
            connection to manage — any agent with a valid token can build; revoke the token to cut access.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
