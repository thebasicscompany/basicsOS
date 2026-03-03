"use client";

import { ArrowSquareOutIcon, EyeIcon, EyeSlashIcon, SunIcon, MoonIcon, MonitorIcon } from "@phosphor-icons/react";
import { useState, useCallback } from "react";
import { useTheme } from "next-themes";

const API_URL = import.meta.env.VITE_API_URL ?? "";

async function persistApiKey(key: string | null) {
  await fetch(`${API_URL}/api/settings`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ basicsApiKey: key }),
  });
}

import { toast } from "sonner";
import { useGateway } from "@/hooks/useGateway";
import { ConnectionsContent } from "@/components/connections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VALID_PREFIXES = ["bos_live_sk_", "bos_test_sk_"] as const;

function isValidApiKey(key: string): boolean {
  return VALID_PREFIXES.some((p) => key.startsWith(p));
}

function maskApiKey(key: string): string {
  if (key.length <= 16) return key.slice(0, 12) + "****";
  return key.slice(0, 12) + "..." + key.slice(-4);
}

const DASHBOARD_URL = "https://basics.so/dashboard";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

import { usePageTitle } from "@/contexts/page-header";

export function SettingsPage() {
  usePageTitle("Settings");
  const { theme, setTheme } = useTheme();
  const { apiKey, hasKey, setApiKey, clearApiKey } = useGateway();
  const [inputValue, setInputValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const handleSave = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) { toast.error("Please enter an API key"); return; }
    if (!isValidApiKey(trimmed)) {
      toast.error("API key must start with bos_live_sk_ or bos_test_sk_");
      return;
    }
    try {
      setApiKey(trimmed);
      setInputValue("");
      await persistApiKey(trimmed);
      toast.success("API key saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save key");
    }
  }, [inputValue, setApiKey]);

  const handleClear = useCallback(async () => {
    clearApiKey();
    setInputValue("");
    setClearDialogOpen(false);
    await persistApiKey(null);
    toast.success("API key cleared");
  }, [clearApiKey]);

  return (
    <div className="flex h-full flex-col overflow-auto py-4">
      <p className="mb-4 text-[12px] text-muted-foreground">Application configuration</p>

      <div className="max-w-lg space-y-4">
        {/* Appearance */}
        <div className="rounded-lg border p-4">
          <h2 className="text-[13px] font-medium">Appearance</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Customize how the app looks.
          </p>
          <div className="mt-3">
            <Label className="text-[12px]">Theme</Label>
            <Select
              value={theme ?? "system"}
              onValueChange={(v) => setTheme(v)}
            >
              <SelectTrigger className="mt-1.5 h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <SelectItem key={opt.value} value={opt.value} className="gap-2">
                      <Icon className="size-4" />
                      {opt.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* API Configuration */}
        <div className="rounded-lg border p-4">
          <h2 className="text-[13px] font-medium">API Configuration</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            API key for chat, voice, and AI features.
          </p>

          <div className="mt-3 space-y-2">
            <Label htmlFor="api-key" className="text-[12px]">API key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showPassword ? "text" : "password"}
                  placeholder={hasKey ? maskApiKey(apiKey!) : "Paste your bos_live_sk_... key"}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="h-8 pr-9 text-[13px]"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 size-7 -translate-y-1/2"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? "Hide key" : "Show key"}
                >
                  {showPassword ? <EyeSlashIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                </Button>
              </div>
              <Button size="sm" className="h-8 text-[13px]" onClick={handleSave} disabled={!inputValue.trim()}>
                Save
              </Button>
            </div>
            {hasKey && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-muted-foreground">
                  Configured: {maskApiKey(apiKey!)}
                </span>
                <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 text-[12px] text-destructive hover:text-destructive">
                      Clear
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Clear API key?</DialogTitle>
                      <DialogDescription>
                        Chat and voice features will stop working until you add a new key.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" size="sm" onClick={() => setClearDialogOpen(false)}>Cancel</Button>
                      <Button variant="destructive" size="sm" onClick={handleClear}>Clear key</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>

          <div className="mt-3">
            <a
              href={DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Get an API key from basics.so
              <ArrowSquareOutIcon className="size-3" />
            </a>
          </div>
        </div>

        {/* Connections (for automations: Gmail, Slack) */}
        <div id="connections" className="rounded-lg border p-4 scroll-mt-4">
          <h2 className="text-[13px] font-medium">Connections</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Connect Gmail and Slack for use in automations.
          </p>
          <div className="mt-3">
            <ConnectionsContent embeddedInSettings />
          </div>
        </div>
      </div>
    </div>
  );
}

SettingsPage.path = "/settings";
