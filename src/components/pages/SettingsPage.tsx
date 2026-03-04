"use client";

import {
  ArrowSquareOutIcon,
  EyeIcon,
  EyeSlashIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
} from "@phosphor-icons/react";
import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";
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
import { useQueryClient } from "@tanstack/react-query";
import { useGateway } from "@/hooks/useGateway";
import { useMe } from "@/hooks/use-me";
import { useOrganization } from "@/hooks/use-organization";
import { useAssignRbacRole, useRbacRoles, useRbacUsers } from "@/hooks/use-rbac";
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
import { Separator } from "@/components/ui/separator";

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
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const { apiKey, hasKey, setApiKey, clearApiKey } = useGateway();
  const { data: me } = useMe();
  const { data: organization } = useOrganization();
  const { data: rbacRoles } = useRbacRoles(Boolean(me?.administrator));
  const { data: rbacUsers } = useRbacUsers(Boolean(me?.administrator));
  const assignRole = useAssignRbacRole();
  const [inputValue, setInputValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgLogoUrl, setOrgLogoUrl] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteExpiresInHours, setInviteExpiresInHours] = useState("168");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, string>>({});

  // Handle OAuth redirect from /connections?connected=slack (or google)
  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) {
      const name = connected.charAt(0).toUpperCase() + connected.slice(1);
      toast.success(`${name} connected!`);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("connected");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!organization) return;
    setOrgName(organization.name ?? "");
    setOrgLogoUrl(organization.logo?.src ?? "");
  }, [organization?.id, organization?.name, organization?.logo?.src]);

  useEffect(() => {
    if (!rbacUsers) return;
    const next: Record<number, string> = {};
    for (const user of rbacUsers) {
      const current = user.roles[0]?.key;
      if (current) next[user.id] = current;
    }
    setRoleDrafts(next);
  }, [rbacUsers]);

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

  const handleCreateInvite = useCallback(async () => {
    setCreatingInvite(true);
    try {
      const res = await fetch(`${API_URL}/api/invites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim() || null,
          expiresInHours: Number(inviteExpiresInHours),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        token?: string;
        expiresAt?: string;
      };
      if (!res.ok || !json.token) {
        throw new Error(json.error ?? "Failed to create invite");
      }
      setInviteToken(json.token);
      setInviteExpiresAt(json.expiresAt ?? null);
      toast.success("Invite token created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setCreatingInvite(false);
    }
  }, [inviteEmail, inviteExpiresInHours]);

  const signupLink = inviteToken ? `${window.location.origin}/sign-up?invite=${inviteToken}` : "";

  const copyText = useCallback(async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Failed to copy");
    }
  }, []);

  const handleSaveOrganization = useCallback(async () => {
    const trimmedName = orgName.trim();
    if (!trimmedName) {
      toast.error("Organization name is required");
      return;
    }
    setSavingOrg(true);
    try {
      const trimmedLogo = orgLogoUrl.trim();
      const res = await fetch(`${API_URL}/api/organization`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          logo: trimmedLogo ? { src: trimmedLogo } : null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        name?: string;
        logo?: { src: string } | null;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to update organization");
      setOrgName(json.name ?? trimmedName);
      setOrgLogoUrl(json.logo?.src ?? "");
      await queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Organization updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update organization");
    } finally {
      setSavingOrg(false);
    }
  }, [orgLogoUrl, orgName, queryClient]);

  const apiDirty = inputValue.trim().length > 0;
  const orgDirty = !!(
    me?.administrator &&
    organization &&
    (
      orgName.trim() !== (organization.name ?? "") ||
      orgLogoUrl.trim() !== (organization.logo?.src ?? "")
    )
  );
  const hasPendingChanges = apiDirty || orgDirty;
  const configuredApiLabel = apiKey
    ? maskApiKey(apiKey)
    : "Stored securely on server";

  const handleResetPending = useCallback(() => {
    setInputValue("");
    setOrgName(organization?.name ?? "");
    setOrgLogoUrl(organization?.logo?.src ?? "");
  }, [organization?.logo?.src, organization?.name]);

  const sectionClass = "scroll-mt-20 px-6 py-6 sm:px-8";

  return (
    <div className="flex h-full flex-col overflow-auto py-5">
      <div className="mb-5">
        <p className="mt-1 text-[12px] text-muted-foreground">
          Configure workspace preferences, security, organization controls, and integrations.
        </p>
      </div>

      <div className="max-w-4xl">
        <div className="rounded-xl border bg-background shadow-sm">
          <section id="appearance" className={sectionClass}>
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold">Appearance</h2>
              <p className="text-[12px] text-muted-foreground">Customize the visual experience for your workspace.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
              <Label className="text-[12px] text-muted-foreground">Theme</Label>
              <Select value={theme ?? "system"} onValueChange={(v) => setTheme(v)}>
                <SelectTrigger className="h-9 w-full sm:max-w-[220px]">
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
          </section>

          <Separator />

          <section id="api" className={sectionClass}>
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold">API Configuration</h2>
              <p className="text-[12px] text-muted-foreground">Manage API access used by assistant, voice, and automations.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
              <Label htmlFor="api-key" className="pt-2 text-[12px] text-muted-foreground">API key</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="api-key"
                      type={showPassword ? "text" : "password"}
                      placeholder={hasKey ? configuredApiLabel : "Paste your bos_live_sk_... key"}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="h-9 pr-9 text-[13px]"
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
                  <Button size="sm" className="h-9 text-[13px]" onClick={handleSave} disabled={!inputValue.trim()}>
                    Save
                  </Button>
                </div>
                {hasKey && (
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-muted-foreground">
                      Configured: {configuredApiLabel}
                    </span>
                    <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-[12px] text-destructive hover:text-destructive">
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
          </section>

          {me?.administrator && (
            <>
              <Separator />
              <section id="organization" className={sectionClass}>
                <div className="mb-4">
                  <h2 className="text-[15px] font-semibold">Organization</h2>
                  <p className="text-[12px] text-muted-foreground">Set workspace identity seen by your team.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Label htmlFor="org-name" className="pt-2 text-[12px] text-muted-foreground">Organization name</Label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="h-9 text-[13px]"
                  />
                  <Label htmlFor="org-logo-url" className="pt-2 text-[12px] text-muted-foreground">Logo image URL</Label>
                  <div className="space-y-2">
                    <Input
                      id="org-logo-url"
                      type="url"
                      value={orgLogoUrl}
                      onChange={(e) => setOrgLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="h-9 text-[13px]"
                    />
                    {orgLogoUrl.trim() && (
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
                        <img
                          src={orgLogoUrl}
                          alt="Organization logo preview"
                          className="size-8 rounded object-cover"
                        />
                        <p className="text-[12px] text-muted-foreground">Preview</p>
                      </div>
                    )}
                  </div>
                  <div />
                  <div>
                    <Button size="sm" className="h-9 text-[13px]" onClick={handleSaveOrganization} disabled={savingOrg}>
                      {savingOrg ? "Saving..." : "Save organization"}
                    </Button>
                  </div>
                </div>
              </section>
            </>
          )}

          {me?.administrator && (
            <>
              <Separator />
              <section id="invites" className={sectionClass}>
                <div className="mb-4">
                  <h2 className="text-[15px] font-semibold">Team Invites</h2>
                  <p className="text-[12px] text-muted-foreground">Issue secure invite tokens for onboarding new teammates.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Label htmlFor="invite-email" className="pt-2 text-[12px] text-muted-foreground">Email lock (optional)</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="h-9 text-[13px]"
                  />
                  <Label className="pt-2 text-[12px] text-muted-foreground">Token expiry</Label>
                  <Select value={inviteExpiresInHours} onValueChange={setInviteExpiresInHours}>
                    <SelectTrigger className="h-9 w-full sm:max-w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="72">3 days</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                      <SelectItem value="720">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <div />
                  <div>
                    <Button size="sm" className="h-9 text-[13px]" onClick={handleCreateInvite} disabled={creatingInvite}>
                      {creatingInvite ? "Creating..." : "Create invite"}
                    </Button>
                  </div>
                </div>

                {inviteToken && (
                  <div className="mt-4 rounded-lg border bg-muted/20 p-3">
                    <div className="space-y-2">
                      <Label className="text-[12px] text-muted-foreground">Invite code</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={inviteToken} className="h-9 text-[12px]" />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-[12px]"
                          onClick={() => copyText(inviteToken, "Invite code copied")}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label className="text-[12px] text-muted-foreground">Signup link</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={signupLink} className="h-9 text-[12px]" />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-[12px]"
                          onClick={() => copyText(signupLink, "Signup link copied")}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                    {inviteExpiresAt && (
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        Expires at: {new Date(inviteExpiresAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          {me?.administrator && (
            <>
              <Separator />
              <section id="roles" className={sectionClass}>
                <div className="mb-4">
                  <h2 className="text-[15px] font-semibold">Roles and Access</h2>
                  <p className="text-[12px] text-muted-foreground">Control who can manage settings and destructive actions.</p>
                </div>
                <div className="space-y-3">
                  {(rbacUsers ?? []).map((user) => {
                    const selected = roleDrafts[user.id] ?? user.roles[0]?.key ?? "";
                    const isSelf = user.id === me?.id;
                    return (
                      <div key={user.id} className="rounded-lg border p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-[13px] font-medium">{user.firstName} {user.lastName}</p>
                            <p className="text-[12px] text-muted-foreground">{user.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={selected}
                              onValueChange={(value) =>
                                setRoleDrafts((prev) => ({ ...prev, [user.id]: value }))
                              }
                              disabled={isSelf || assignRole.isPending}
                            >
                              <SelectTrigger className="h-9 w-[200px]">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                {(rbacRoles ?? []).map((role) => (
                                  <SelectItem key={role.key} value={role.key}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 text-[12px]"
                              disabled={isSelf || assignRole.isPending || !selected || selected === (user.roles[0]?.key ?? "")}
                              onClick={async () => {
                                try {
                                  await assignRole.mutateAsync({ crmUserId: user.id, roleKey: selected });
                                  toast.success("Role updated");
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Failed to update role");
                                }
                              }}
                            >
                              Save role
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          <Separator />

          <section id="connections" className={sectionClass}>
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold">Connections</h2>
              <p className="text-[12px] text-muted-foreground">Connect Gmail and Slack for automation workflows.</p>
            </div>
            <ConnectionsContent embeddedInSettings />
          </section>

          {hasPendingChanges && (
            <div className="sticky bottom-0 z-20 border-t bg-background/95 px-6 py-3 backdrop-blur-sm sm:px-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] text-muted-foreground">
                  You have unsaved changes.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[12px]"
                    onClick={handleResetPending}
                  >
                    Discard
                  </Button>
                  {apiDirty && (
                    <Button
                      size="sm"
                      className="h-8 text-[12px]"
                      onClick={handleSave}
                      disabled={!inputValue.trim()}
                    >
                      Save API key
                    </Button>
                  )}
                  {orgDirty && (
                    <Button
                      size="sm"
                      className="h-8 text-[12px]"
                      onClick={handleSaveOrganization}
                      disabled={savingOrg}
                    >
                      {savingOrg ? "Saving..." : "Save organization"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

SettingsPage.path = "/settings";
