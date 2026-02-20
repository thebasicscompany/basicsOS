"use client";

import { useState } from "react";
import {
  Button, Input, Label, Download, addToast, Copy, Check,
  Tabs, TabsList, TabsTrigger, TabsContent, PageHeader, Kbd,
  Card, CodeBlock, Avatar, AvatarFallback, InlineCode,
} from "@basicsos/ui";
import { useAuth } from "@/providers/AuthProvider";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

const mcpHttpUrl = process.env["NEXT_PUBLIC_MCP_URL"] ?? "http://localhost:4000";

// Next.js App Router requires default export — framework exception
const SettingsPage = (): JSX.Element => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"account" | "mcp" | "desktop">("account");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [copiedTenantId, setCopiedTenantId] = useState(false);

  const { data: me } = trpc.auth.me.useQuery();
  const tenantId = me?.tenantId ?? "\u2026";
  const userId = me?.userId ?? "\u2026";

  const localStdioConfig = JSON.stringify(
    {
      mcpServers: {
        basicsos: {
          command: "bun",
          args: ["run", "/path/to/basicsOS/apps/mcp/company/src/index.ts"],
          env: {
            MCP_TENANT_ID: tenantId,
            MCP_USER_ID: userId,
            DATABASE_URL: "postgresql://basicos:basicos_dev@localhost:5432/basicos",
            REDIS_URL: "redis://localhost:6379",
          },
        },
      },
    },
    null,
    2,
  );

  const remoteHttpConfig = JSON.stringify(
    {
      mcpServers: {
        basicsos: {
          type: "streamable-http",
          url: `${mcpHttpUrl}`,
          headers: { "X-Tenant-ID": tenantId, "X-User-ID": userId },
        },
      },
    },
    null,
    2,
  );

  const handlePasswordChange = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!newPassword.trim()) return;
    setSavingPassword(true);
    try {
      await authClient.changePassword({ currentPassword, newPassword });
      addToast({ title: "Password updated", variant: "success" });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      addToast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCopyTenantId = (): void => {
    void navigator.clipboard.writeText(tenantId).then(() => {
      setCopiedTenantId(true);
      setTimeout(() => setCopiedTenantId(false), 2000);
    });
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "A";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Settings"
        description="Manage your account and connections."
        className="mb-6"
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="mcp">MCP Connection</TabsTrigger>
          <TabsTrigger value="desktop">Desktop App</TabsTrigger>
        </TabsList>

      {/* Account tab */}
      <TabsContent value="account">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 text-base font-semibold text-stone-900">Profile</h2>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-stone-700">{user?.name ?? "\u2014"}</p>
                <p className="text-sm text-stone-500">{user?.email ?? "\u2014"}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-base font-semibold text-stone-900">Change Password</h2>
            <form onSubmit={(e) => void handlePasswordChange(e)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? "Saving..." : "Update Password"}
              </Button>
            </form>
          </Card>
        </div>
      </TabsContent>

      {/* MCP Connection tab */}
      <TabsContent value="mcp">
        <div className="space-y-6">
          {/* Tenant ID */}
          <Card className="p-6">
            <h2 className="mb-1 text-base font-semibold text-stone-900">Your Tenant ID</h2>
            <p className="mb-4 text-sm text-stone-500">
              Copy this into your MCP config to scope queries to your company data.
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-white shadow-card px-3 py-2">
              <code className="flex-1 text-xs font-mono text-stone-800 select-all">{tenantId}</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyTenantId}
                title="Copy tenant ID"
                className="h-7 w-7"
              >
                {copiedTenantId ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
          </Card>

          {/* Local / stdio config */}
          <Card className="p-6">
            <h2 className="mb-1 text-base font-semibold text-stone-900">Local Setup (stdio)</h2>
            <p className="mb-4 text-sm text-stone-500">
              Use this when Basics OS is running on the same machine as Claude Desktop.
              Replace the <InlineCode>args</InlineCode> path
              with the actual path to your cloned repo, and update <InlineCode>DATABASE_URL</InlineCode> from your <InlineCode>.env</InlineCode> file.
            </p>
            <CodeBlock label="claude_desktop_config.json" code={localStdioConfig} />
          </Card>

          {/* Remote / HTTP config */}
          <Card className="p-6">
            <h2 className="mb-1 text-base font-semibold text-stone-900">Remote Setup (HTTP)</h2>
            <p className="mb-4 text-sm text-stone-500">
              Use this when the MCP server is deployed separately. The server must be
              started with <InlineCode>MCP_TRANSPORT=http</InlineCode>.
            </p>
            <CodeBlock label="claude_desktop_config.json" code={remoteHttpConfig} />
          </Card>
        </div>
      </TabsContent>

      {/* Desktop tab */}
      <TabsContent value="desktop">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-1 text-base font-semibold text-stone-900">Desktop App</h2>
            <p className="mb-4 text-sm text-stone-500">
              The Basics OS desktop app gives you an always-on overlay accessible anywhere.
            </p>

            <div className="space-y-4">
              <Button asChild>
                <a href="/api/desktop">
                  <Download size={14} className="mr-1" /> Download Desktop App
                </a>
              </Button>

              <div className="rounded-lg bg-white shadow-card p-4 space-y-2">
                <h3 className="text-sm font-medium text-stone-700">Keyboard Shortcut</h3>
                <p className="text-sm text-stone-500">
                  Press <Kbd>⌘ Shift Space</Kbd> anywhere to toggle the AI overlay.
                </p>
              </div>

              <div className="rounded-lg bg-white shadow-card p-4 space-y-2">
                <h3 className="text-sm font-medium text-stone-700">Setup</h3>
                <ol className="text-sm text-stone-500 space-y-1 list-decimal list-inside">
                  <li>Download and install the app above</li>
                  <li>Set <InlineCode>BASICOS_URL=http://localhost:3000</InlineCode> in your environment</li>
                  <li>Launch the app — it runs in your system tray</li>
                  <li>Press <Kbd>⌘⇧Space</Kbd> to open the overlay</li>
                </ol>
              </div>
            </div>
          </Card>
        </div>
      </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
