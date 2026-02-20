"use client";

import { useState } from "react";
import { Button, Input, Label, Download, addToast, Copy, Check } from "@basicsos/ui";
import { useAuth } from "@/providers/AuthProvider";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

const mcpHttpUrl = process.env["NEXT_PUBLIC_MCP_URL"] ?? "http://localhost:4000";

const CopyBlock = ({ label, code }: { label: string; code: string }): JSX.Element => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</span>
        <Button size="sm" variant="outline" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-stone-900 p-4 text-xs text-stone-100 whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
};

// Next.js App Router requires default export — framework exception
const SettingsPage = (): JSX.Element => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"account" | "mcp" | "desktop">("account");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [copiedTenantId, setCopiedTenantId] = useState(false);

  const { data: me } = trpc.auth.me.useQuery();
  const tenantId = me?.tenantId ?? "…";
  const userId = me?.userId ?? "…";

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

  const TABS = [
    { id: "account" as const, label: "Account" },
    { id: "mcp" as const, label: "MCP Connection" },
    { id: "desktop" as const, label: "Desktop App" },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Settings</h1>
        <p className="mt-1 text-sm text-stone-500">Manage your account and connections.</p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Account tab */}
      {tab === "account" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-stone-900">Profile</h2>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {user?.name?.split(" ").map((n: string) => n[0] ?? "").join("").toUpperCase().slice(0, 2) ?? "A"}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-stone-700">{user?.name ?? "\u2014"}</p>
                <p className="text-sm text-stone-500">{user?.email ?? "\u2014"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-6">
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
          </div>
        </div>
      )}

      {/* MCP Connection tab */}
      {tab === "mcp" && (
        <div className="space-y-6">
          {/* Tenant ID */}
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-stone-900">Your Tenant ID</h2>
            <p className="mb-4 text-sm text-stone-500">
              Copy this into your MCP config to scope queries to your company data.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <code className="flex-1 text-xs font-mono text-stone-800 select-all">{tenantId}</code>
              <button
                type="button"
                onClick={handleCopyTenantId}
                className="text-stone-400 hover:text-stone-600 transition-colors"
                title="Copy tenant ID"
              >
                {copiedTenantId ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Local / stdio config */}
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-stone-900">Local Setup (stdio)</h2>
            <p className="mb-4 text-sm text-stone-500">
              Use this when Basics OS is running on the same machine as Claude Desktop.
              Replace the <code className="text-xs bg-stone-100 px-1 rounded">args</code> path
              with the actual path to your cloned repo, and update <code className="text-xs bg-stone-100 px-1 rounded">DATABASE_URL</code> from your <code className="text-xs bg-stone-100 px-1 rounded">.env</code> file.
            </p>
            <CopyBlock label="claude_desktop_config.json" code={localStdioConfig} />
          </div>

          {/* Remote / HTTP config */}
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-stone-900">Remote Setup (HTTP)</h2>
            <p className="mb-4 text-sm text-stone-500">
              Use this when the MCP server is deployed separately. The server must be
              started with <code className="text-xs bg-stone-100 px-1 rounded">MCP_TRANSPORT=http</code>.
            </p>
            <CopyBlock label="claude_desktop_config.json" code={remoteHttpConfig} />
          </div>
        </div>
      )}

      {/* Desktop tab */}
      {tab === "desktop" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-stone-200 bg-white p-6">
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

              <div className="rounded-lg border border-stone-100 bg-stone-50 p-4 space-y-2">
                <h3 className="text-sm font-medium text-stone-700">Keyboard Shortcut</h3>
                <p className="text-sm text-stone-500">
                  Press <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 text-xs font-mono">⌘ Shift Space</kbd> anywhere to toggle the AI overlay.
                </p>
              </div>

              <div className="rounded-lg border border-stone-100 bg-stone-50 p-4 space-y-2">
                <h3 className="text-sm font-medium text-stone-700">Setup</h3>
                <ol className="text-sm text-stone-500 space-y-1 list-decimal list-inside">
                  <li>Download and install the app above</li>
                  <li>Set <code className="text-xs">BASICOS_URL=http://localhost:3000</code> in your environment</li>
                  <li>Launch the app — it runs in your system tray</li>
                  <li>Press <kbd className="rounded border border-stone-300 bg-white px-1 py-0.5 text-xs font-mono">⌘⇧Space</kbd> to open the overlay</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
