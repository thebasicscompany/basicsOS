"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button, Input, Label, DownloadSimple, addToast, Copy, Check, Switch,
  Tabs, TabsList, TabsTrigger, TabsContent, PageHeader, Kbd,
  Card, CodeBlock, Avatar, AvatarFallback, InlineCode,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Sparkle, PencilLine,
} from "@basicsos/ui";
import { useAuth } from "@/providers/AuthProvider";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

const mcpHttpUrl = process.env["NEXT_PUBLIC_MCP_URL"] ?? "http://localhost:4000";

// ---------------------------------------------------------------------------
// Overlay settings types + defaults (mirrors desktop electron-store)
// ---------------------------------------------------------------------------

type OverlaySettings = {
  shortcuts: { assistantToggle: string; dictationToggle: string };
  voice: { language: string; silenceTimeoutMs: number; ttsEnabled: boolean; ttsRate: number };
  behavior: { doubleTapWindowMs: number; autoDismissMs: number; showDictationPreview: boolean };
};

const OVERLAY_DEFAULTS: OverlaySettings = {
  shortcuts: { assistantToggle: "Control+Space", dictationToggle: "Control+Shift+Space" },
  voice: { language: "en-US", silenceTimeoutMs: 2000, ttsEnabled: true, ttsRate: 1.05 },
  behavior: { doubleTapWindowMs: 400, autoDismissMs: 5000, showDictationPreview: true },
};

const STORAGE_KEY = "basicos:overlay-settings";

const loadOverlaySettings = (): OverlaySettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return OVERLAY_DEFAULTS;
    return JSON.parse(raw) as OverlaySettings;
  } catch {
    return OVERLAY_DEFAULTS;
  }
};

const saveOverlaySettings = (settings: OverlaySettings): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

// ---------------------------------------------------------------------------
// Shortcut display helper
// ---------------------------------------------------------------------------

const formatShortcut = (shortcut: string): string => {
  const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  if (isMac) {
    return shortcut
      .replace("Control", "\u2303")
      .replace("Shift", "\u21e7")
      .replace("Alt", "\u2325")
      .replace("Command", "\u2318")
      .replace("CommandOrControl", "\u2318")
      .replace(/\+/g, "");
  }
  return shortcut;
};

// ---------------------------------------------------------------------------
// Key capture hook
// ---------------------------------------------------------------------------

const useKeyCapture = (
  active: boolean,
  onCapture: (combo: string) => void,
): void => {
  useEffect(() => {
    if (!active) return;

    const handler = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Control");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");
      if (e.metaKey) parts.push("Command");

      // Ignore modifier-only presses
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      parts.push(e.key === " " ? "Space" : e.key.charAt(0).toUpperCase() + e.key.slice(1));
      onCapture(parts.join("+"));
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [active, onCapture]);
};

// ---------------------------------------------------------------------------
// Overlay Settings Tab
// ---------------------------------------------------------------------------

const OverlaySettingsTab = (): JSX.Element => {
  const [settings, setSettings] = useState<OverlaySettings>(OVERLAY_DEFAULTS);
  const [capturingAssistant, setCapturingAssistant] = useState(false);
  const [capturingDictation, setCapturingDictation] = useState(false);

  useEffect(() => {
    setSettings(loadOverlaySettings());
  }, []);

  const save = useCallback((updated: OverlaySettings) => {
    setSettings(updated);
    saveOverlaySettings(updated);
  }, []);

  const pushToDesktop = useCallback((updated: OverlaySettings) => {
    try {
      const json = encodeURIComponent(JSON.stringify(updated));
      window.location.href = `basicos://update-settings?json=${json}`;
    } catch {
      // Protocol not registered — desktop app not installed
    }
    addToast({ title: "Settings saved", variant: "success" });
  }, []);

  useKeyCapture(capturingAssistant, (combo) => {
    const updated = { ...settings, shortcuts: { ...settings.shortcuts, assistantToggle: combo } };
    save(updated);
    setCapturingAssistant(false);
  });

  useKeyCapture(capturingDictation, (combo) => {
    const updated = { ...settings, shortcuts: { ...settings.shortcuts, dictationToggle: combo } };
    save(updated);
    setCapturingDictation(false);
  });

  return (
    <div className="space-y-6">
      {/* Keyboard Shortcuts */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Keyboard Shortcuts</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkle size={14} className="text-muted-foreground" />
              <span className="text-sm text-foreground">AI Assistant</span>
              <span className="text-xs text-muted-foreground">(tap / double-tap for continuous)</span>
            </div>
            <div className="flex items-center gap-2">
              {capturingAssistant ? (
                <Kbd className="animate-pulse bg-primary/10 text-primary">Press keys...</Kbd>
              ) : (
                <Kbd>{formatShortcut(settings.shortcuts.assistantToggle)}</Kbd>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCapturingDictation(false);
                  setCapturingAssistant(!capturingAssistant);
                }}
              >
                {capturingAssistant ? "Cancel" : "Change"}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PenLine size={14} className="text-muted-foreground" />
              <span className="text-sm text-foreground">Dictation to Paste</span>
            </div>
            <div className="flex items-center gap-2">
              {capturingDictation ? (
                <Kbd className="animate-pulse bg-primary/10 text-primary">Press keys...</Kbd>
              ) : (
                <Kbd>{formatShortcut(settings.shortcuts.dictationToggle)}</Kbd>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCapturingAssistant(false);
                  setCapturingDictation(!capturingDictation);
                }}
              >
                {capturingDictation ? "Cancel" : "Change"}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Double-tap speed</Label>
            <Select
              value={String(settings.behavior.doubleTapWindowMs)}
              onValueChange={(v) => {
                const updated = { ...settings, behavior: { ...settings.behavior, doubleTapWindowMs: Number(v) } };
                save(updated);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="200">Fast (200ms)</SelectItem>
                <SelectItem value="400">Normal (400ms)</SelectItem>
                <SelectItem value="800">Slow (800ms)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Voice */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Voice</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Silence timeout</Label>
              <p className="text-xs text-muted-foreground">Auto-stop listening after this silence</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1000}
                max={5000}
                step={500}
                value={settings.voice.silenceTimeoutMs}
                onChange={(e) => {
                  const updated = { ...settings, voice: { ...settings.voice, silenceTimeoutMs: Number(e.target.value) } };
                  save(updated);
                }}
                className="w-24"
              />
              <span className="w-10 text-right text-xs text-muted-foreground">{settings.voice.silenceTimeoutMs / 1000}s</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Text-to-speech</Label>
              <p className="text-xs text-muted-foreground">Read AI responses aloud</p>
            </div>
            <Switch
              checked={settings.voice.ttsEnabled}
              onCheckedChange={(checked) => {
                const updated = { ...settings, voice: { ...settings.voice, ttsEnabled: checked } };
                save(updated);
              }}
            />
          </div>

          {settings.voice.ttsEnabled && (
            <div className="flex items-center justify-between">
              <Label className="text-sm text-foreground">Speech rate</Label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={settings.voice.ttsRate}
                  onChange={(e) => {
                    const updated = { ...settings, voice: { ...settings.voice, ttsRate: Number(e.target.value) } };
                    save(updated);
                  }}
                  className="w-24"
                />
                <span className="w-10 text-right text-xs text-muted-foreground">{settings.voice.ttsRate.toFixed(1)}x</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Behavior */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Behavior</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Auto-dismiss delay</Label>
              <p className="text-xs text-muted-foreground">How long to show AI responses</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={2000}
                max={30000}
                step={1000}
                value={settings.behavior.autoDismissMs}
                onChange={(e) => {
                  const updated = { ...settings, behavior: { ...settings.behavior, autoDismissMs: Number(e.target.value) } };
                  save(updated);
                }}
                className="w-24"
              />
              <span className="w-10 text-right text-xs text-muted-foreground">{settings.behavior.autoDismissMs / 1000}s</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Show dictation preview</Label>
              <p className="text-xs text-muted-foreground">Display live transcript while dictating</p>
            </div>
            <Switch
              checked={settings.behavior.showDictationPreview}
              onCheckedChange={(checked) => {
                const updated = { ...settings, behavior: { ...settings.behavior, showDictationPreview: checked } };
                save(updated);
              }}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => pushToDesktop(settings)}>
          Save & Push to Desktop
        </Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Settings Page
// ---------------------------------------------------------------------------

// Next.js App Router requires default export — framework exception
const SettingsPage = (): JSX.Element => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"account" | "mcp" | "desktop" | "overlay">("account");
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
          <TabsTrigger value="overlay">Overlay</TabsTrigger>
        </TabsList>

      {/* Account tab */}
      <TabsContent value="account">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">Profile</h2>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{user?.name ?? "\u2014"}</p>
                <p className="text-sm text-muted-foreground">{user?.email ?? "\u2014"}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">Change Password</h2>
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
            <h2 className="mb-1 text-base font-semibold text-foreground">Your Tenant ID</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Copy this into your MCP config to scope queries to your company data.
            </p>
            <div className="flex items-center gap-2 rounded-sm bg-muted border border-border px-3 py-2">
              <code className="flex-1 text-xs font-mono text-foreground select-all">{tenantId}</code>
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
            <h2 className="mb-1 text-base font-semibold text-foreground">Local Setup (stdio)</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Use this when Basics OS is running on the same machine as Claude Desktop.
              Replace the <InlineCode>args</InlineCode> path
              with the actual path to your cloned repo, and update <InlineCode>DATABASE_URL</InlineCode> from your <InlineCode>.env</InlineCode> file.
            </p>
            <CodeBlock label="claude_desktop_config.json" code={localStdioConfig} />
          </Card>

          {/* Remote / HTTP config */}
          <Card className="p-6">
            <h2 className="mb-1 text-base font-semibold text-foreground">Remote Setup (HTTP)</h2>
            <p className="mb-4 text-sm text-muted-foreground">
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
            <h2 className="mb-1 text-base font-semibold text-foreground">Desktop App</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              The Basics OS desktop app gives you an always-on overlay accessible anywhere.
            </p>

            <div className="space-y-4">
              <Button asChild>
                <a href="/api/desktop">
                  <DownloadSimple size={14} className="mr-1" /> Download Desktop App
                </a>
              </Button>

              <div className="rounded-sm bg-muted border border-border p-4 space-y-2">
                <h3 className="text-sm font-medium text-foreground">Keyboard Shortcuts</h3>
                <p className="text-sm text-muted-foreground">
                  <Kbd>Ctrl Space</Kbd> — AI assistant (double-tap for continuous listening)
                </p>
                <p className="text-sm text-muted-foreground">
                  <Kbd>Ctrl Shift Space</Kbd> — Dictation to paste
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Customize shortcuts in the Overlay tab.
                </p>
              </div>

              <div className="rounded-sm bg-muted border border-border p-4 space-y-2">
                <h3 className="text-sm font-medium text-foreground">Setup</h3>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Download and install the app above</li>
                  <li>Set <InlineCode>BASICOS_URL=http://localhost:3000</InlineCode> in your environment</li>
                  <li>Launch the app — it runs in your system tray</li>
                  <li>Press <Kbd>Ctrl Space</Kbd> to open the overlay</li>
                </ol>
              </div>
            </div>
          </Card>
        </div>
      </TabsContent>

      {/* Overlay tab */}
      <TabsContent value="overlay">
        <OverlaySettingsTab />
      </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
