"use client";

import {
  EyeIcon,
  EyeSlashIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
} from "@phosphor-icons/react";
import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useTheme } from "next-themes";

import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useOrganization } from "@/hooks/use-organization";
import {
  useAssignRbacRole,
  useRbacRoles,
  useRbacUsers,
} from "@/hooks/use-rbac";
import {
  useAdminAiConfig,
  useSaveAdminAiConfig,
  useClearAdminAiConfig,
  useSaveAdminTranscriptionByok,
  useAdminSmtpConfig,
  useSaveAdminSmtpConfig,
  useClearAdminSmtpConfig,
  useAdminSlackBotStatus,
  useSaveAdminSlackBot,
} from "@/hooks/use-admin";
import { ConnectionsContent } from "@/components/connections";
import {
  useEmailSyncStatus,
  useStartEmailSync,
  useUpdateSyncSettings,
  useTriggerSync,
  useStopEmailSync,
} from "@/hooks/use-email-sync";
import { Switch } from "@/components/ui/switch";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

import { getRuntimeApiUrl } from "@/lib/runtime-config";
const API_URL = getRuntimeApiUrl();

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
  const { data: me } = useMe();
  const navigate = useNavigate();
  const { restartOnboarding, isRestartingOnboarding } = useOnboarding();
  const { data: organization } = useOrganization();
  const { data: rbacRoles } = useRbacRoles(Boolean(me?.administrator));
  const { data: rbacUsers } = useRbacUsers(Boolean(me?.administrator));
  const assignRole = useAssignRbacRole();

  // Admin AI config
  const isAdmin = Boolean(me?.administrator);
  const { data: aiConfigData } = useAdminAiConfig(isAdmin);
  const saveAiConfig = useSaveAdminAiConfig();
  const clearAiConfig = useClearAdminAiConfig();
  const [aiKeyType, setAiKeyType] = useState<string>("basicsos");
  const [aiByokProvider, setAiByokProvider] = useState<string>("openai");
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [showAiKey, setShowAiKey] = useState(false);
  const [clearAiDialogOpen, setClearAiDialogOpen] = useState(false);
  const saveTranscriptionByok = useSaveAdminTranscriptionByok();
  const [transcriptionKeyInput, setTranscriptionKeyInput] = useState("");
  const [showTranscriptionKey, setShowTranscriptionKey] = useState(false);
  const [clearTranscriptionDialogOpen, setClearTranscriptionDialogOpen] =
    useState(false);
  const { data: smtpConfigData } = useAdminSmtpConfig(isAdmin);
  const saveSmtpConfig = useSaveAdminSmtpConfig();
  const clearSmtpConfig = useClearAdminSmtpConfig();

  // Slack bot config
  const { data: slackBotStatus } = useAdminSlackBotStatus(isAdmin);
  const saveSlackBot = useSaveAdminSlackBot();
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackSigningSecret, setSlackSigningSecret] = useState("");
  const [slackTeamId, setSlackTeamId] = useState("");
  const [showSlackToken, setShowSlackToken] = useState(false);
  const [showSlackSecret, setShowSlackSecret] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [clearSmtpDialogOpen, setClearSmtpDialogOpen] = useState(false);

  // Handle OAuth callback when redirected to /settings?connected=slack#connections
  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) {
      const name =
        connected === "google" ? "Gmail" : connected.charAt(0).toUpperCase() + connected.slice(1);
      toast.success(`${name} connected!`);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("connected");
        return next;
      }, { replace: true });
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    }
  }, [searchParams, setSearchParams, queryClient]);

  useEffect(() => {
    if (!aiConfigData?.config) return;
    setAiKeyType(aiConfigData.config.keyType);
    if (aiConfigData.config.byokProvider)
      setAiByokProvider(aiConfigData.config.byokProvider);
  }, [aiConfigData]);

  useEffect(() => {
    if (!smtpConfigData?.config) return;
    setSmtpHost(smtpConfigData.config.host);
    setSmtpPort(String(smtpConfigData.config.port));
    setSmtpUser(smtpConfigData.config.user);
    setSmtpFrom(smtpConfigData.config.fromEmail);
  }, [smtpConfigData]);

  const [orgName, setOrgName] = useState("");
  const [orgLogoUrl, setOrgLogoUrl] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteExpiresInHours, setInviteExpiresInHours] = useState("168");
  const [inviteSendEmail, setInviteSendEmail] = useState(true);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteSignupLink, setInviteSignupLink] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, string>>({});

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
  }, [organization]);

  useEffect(() => {
    if (!rbacUsers) return;
    const next: Record<number, string> = {};
    for (const user of rbacUsers) {
      const current = user.roles[0]?.key;
      if (current) next[user.id] = current;
    }
    setRoleDrafts(next);
  }, [rbacUsers]);

  const handleSaveAiConfig = useCallback(async () => {
    const trimmed = aiKeyInput.trim();
    if (!trimmed) {
      toast.error("Please enter an API key");
      return;
    }
    try {
      await saveAiConfig.mutateAsync({
        keyType: aiKeyType,
        byokProvider: aiKeyType === "byok" ? aiByokProvider : null,
        apiKey: trimmed,
      });
      setAiKeyInput("");
      toast.success("AI configuration saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save AI config",
      );
    }
  }, [aiKeyInput, aiKeyType, aiByokProvider, saveAiConfig]);

  const handleClearAiConfig = useCallback(async () => {
    try {
      await clearAiConfig.mutateAsync();
      setClearAiDialogOpen(false);
      toast.success("AI configuration cleared");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to clear AI config",
      );
    }
  }, [clearAiConfig]);

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
          sendEmail: inviteSendEmail && !!inviteEmail.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        token?: string;
        expiresAt?: string;
        emailSent?: boolean;
        emailError?: string;
      };
      if (!res.ok || !json.token) {
        throw new Error(json.error ?? "Failed to create invite");
      }
      setInviteToken(json.token);
      setInviteSignupLink((json as { signupLink?: string }).signupLink ?? null);
      setInviteExpiresAt(json.expiresAt ?? null);
      if (json.emailSent) {
        toast.success("Invite created and email sent");
      } else if (json.emailError) {
        toast.success("Invite created");
        toast.warning(`Email not sent: ${json.emailError}`);
      } else {
        toast.success("Invite token created");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create invite",
      );
    } finally {
      setCreatingInvite(false);
    }
  }, [inviteEmail, inviteExpiresInHours, inviteSendEmail]);

  const signupLink =
    inviteSignupLink ??
    (inviteToken ? `${window.location.origin}/sign-up?invite=${inviteToken}` : "");

  const copyText = useCallback(
    async (value: string, successMessage: string) => {
      const fallbackCopy = (): boolean => {
        try {
          const el = document.createElement("textarea");
          el.value = value;
          el.setAttribute("readonly", "");
          el.style.position = "absolute";
          el.style.left = "-9999px";
          document.body.appendChild(el);
          el.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(el);
          return ok;
        } catch {
          return false;
        }
      };
      try {
        const electronCopy = (
          window as unknown as {
            electronAPI?: { copyToClipboard?: (t: string) => Promise<void> };
          }
        ).electronAPI?.copyToClipboard;
        if (electronCopy) {
          await electronCopy(value);
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else if (!fallbackCopy()) {
          throw new Error("Copy not supported");
        }
        toast.success(successMessage);
      } catch {
        if (fallbackCopy()) {
          toast.success(successMessage);
        } else {
          toast.error("Failed to copy");
        }
      }
    },
    [],
  );

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
      if (!res.ok)
        throw new Error(json.error ?? "Failed to update organization");
      setOrgName(json.name ?? trimmedName);
      setOrgLogoUrl(json.logo?.src ?? "");
      await queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Organization updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update organization",
      );
    } finally {
      setSavingOrg(false);
    }
  }, [orgLogoUrl, orgName, queryClient]);

  const orgDirty = !!(
    me?.administrator &&
    organization &&
    (orgName.trim() !== (organization.name ?? "") ||
      orgLogoUrl.trim() !== (organization.logo?.src ?? ""))
  );
  const aiConfigDirty = aiKeyInput.trim().length > 0;
  const hasPendingChanges = aiConfigDirty || orgDirty;

  const handleResetPending = useCallback(() => {
    setAiKeyInput("");
    setOrgName(organization?.name ?? "");
    setOrgLogoUrl(organization?.logo?.src ?? "");
  }, [organization?.logo?.src, organization?.name]);

  const sectionClass = "scroll-mt-20 px-6 py-6 sm:px-8";

  return (
    <div className="flex h-full flex-col overflow-auto pb-8">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          Configure workspace preferences, security, organization controls, and
          integrations.
        </p>
      </div>

      <div className="max-w-4xl">
        <div className="rounded-xl bg-card">
          <section id="appearance" className={sectionClass}>
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold">Appearance</h2>
              <p className="text-[12px] text-muted-foreground">
                Customize the visual experience for your workspace.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
              <Label className="text-[12px] text-muted-foreground">Theme</Label>
              <Select
                value={theme ?? "system"}
                onValueChange={(v) => setTheme(v)}
              >
                <SelectTrigger className="h-9 w-full sm:max-w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEME_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="gap-2"
                      >
                        <Icon className="size-4" />
                        {opt.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </section>

          {!isAdmin && me?.hasOrgAiConfig && (
            <>
              <Separator />
              <section id="api" className={sectionClass}>
                <div className="mb-4">
                  <h2 className="text-[15px] font-semibold">
                    AI Configuration
                  </h2>
                  <p className="text-[12px] text-muted-foreground">
                    AI features are configured by your organization
                    administrator. No action needed.
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-[12px] text-muted-foreground">
                    AI chat, voice, and automations are active and managed at
                    the organization level.
                  </p>
                </div>
              </section>
            </>
          )}

          {isAdmin && (
            <>
              <Separator />
              <section id="ai-config" className={sectionClass}>
                <div className="mb-4">
                  <h2 className="text-[15px] font-semibold">
                    AI Configuration
                  </h2>
                  <p className="text-[12px] text-muted-foreground">
                    Configure the API key used by all users for AI chat, voice,
                    and automations. This key is shared across your
                    organization. With a BasicsOS key, transcription and SMTP
                    (email) are included — we handle it for you.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
                  <Label className="pt-2 text-[12px] text-muted-foreground">
                    Key type
                  </Label>
                  <Select value={aiKeyType} onValueChange={setAiKeyType}>
                    <SelectTrigger className="h-9 w-full sm:max-w-[260px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basicsos">
                        BasicsOS key (bos_live_sk_...)
                      </SelectItem>
                      <SelectItem value="byok">
                        BYOK (your own provider key)
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {aiKeyType === "byok" && (
                    <>
                      <Label className="pt-2 text-[12px] text-muted-foreground">
                        Provider
                      </Label>
                      <Select
                        value={aiByokProvider}
                        onValueChange={setAiByokProvider}
                      >
                        <SelectTrigger className="h-9 w-full sm:max-w-[260px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="gemini">Gemini</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  <Label
                    htmlFor="ai-api-key"
                    className="pt-2 text-[12px] text-muted-foreground"
                  >
                    API key
                  </Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="ai-api-key"
                          type={showAiKey ? "text" : "password"}
                          placeholder={
                            aiConfigData?.config?.hasKey
                              ? "Key configured — enter new key to replace"
                              : aiKeyType === "basicsos"
                                ? "bos_live_sk_..."
                                : "Paste your provider API key"
                          }
                          value={aiKeyInput}
                          onChange={(e) => setAiKeyInput(e.target.value)}
                          className="h-9 pr-9 text-[13px]"
                          autoComplete="off"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0.5 top-1/2 size-7 -translate-y-1/2"
                          onClick={() => setShowAiKey((p) => !p)}
                          aria-label={showAiKey ? "Hide key" : "Show key"}
                        >
                          {showAiKey ? (
                            <EyeSlashIcon className="size-3.5" />
                          ) : (
                            <EyeIcon className="size-3.5" />
                          )}
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        className="h-9 text-[13px]"
                        onClick={handleSaveAiConfig}
                        disabled={!aiKeyInput.trim() || saveAiConfig.isPending}
                      >
                        {saveAiConfig.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                    {aiConfigData?.config?.hasKey && (
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-muted-foreground">
                          Active:{" "}
                          {aiConfigData.config.keyType === "byok"
                            ? `BYOK (${aiConfigData.config.byokProvider})`
                            : "BasicsOS key"}{" "}
                          — last updated{" "}
                          {new Date(
                            aiConfigData.config.updatedAt,
                          ).toLocaleDateString()}
                        </span>
                        <Dialog
                          open={clearAiDialogOpen}
                          onOpenChange={setClearAiDialogOpen}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[12px] text-destructive hover:text-destructive"
                            >
                              Clear
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-sm">
                            <DialogHeader>
                              <DialogTitle>Clear AI configuration?</DialogTitle>
                              <DialogDescription>
                                Chat, voice, and automation features will stop
                                working for all users until a new key is
                                configured.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setClearAiDialogOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleClearAiConfig}
                              >
                                Clear config
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}
                    {aiConfigData?.hasEnvFallback && (
                      <p className="text-[12px] text-muted-foreground">
                        Server env fallback active (
                        {aiConfigData.envFallbackType === "byok"
                          ? `BYOK: ${aiConfigData.envByokProvider}`
                          : "BasicsOS key"}
                        ). UI config will take priority.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 border-t pt-6">
                  <h3 className="text-[13px] font-medium mb-1">
                    Transcription (BYOK)
                  </h3>
                  <p className="text-[12px] text-muted-foreground mb-3">
                    {aiConfigData?.config?.keyType === "basicsos" ||
                    aiKeyType === "basicsos" ? (
                      <>
                        With a BasicsOS key, we handle transcription and SMTP
                        (email) for you — don&apos;t worry! Only configure below
                        if you use BYOK and want your own Deepgram key.
                      </>
                    ) : (
                      <>
                        Only required if not using a BasicsOS key. Use your own
                        Deepgram key for voice transcription (speech-to-text).
                        Leave empty to use the main AI key.
                      </>
                    )}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
                    <Label className="pt-2 text-[12px] text-muted-foreground">
                      Provider
                    </Label>
                    <Select value="deepgram" disabled onValueChange={() => {}}>
                      <SelectTrigger className="h-9 w-full sm:max-w-[260px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deepgram">Deepgram</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label
                      htmlFor="transcription-api-key"
                      className="pt-2 text-[12px] text-muted-foreground"
                    >
                      Deepgram API key
                    </Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="transcription-api-key"
                            type={showTranscriptionKey ? "text" : "password"}
                            placeholder={
                              aiConfigData?.config?.hasTranscriptionKey
                                ? "Key configured — enter new key to replace"
                                : "Paste your Deepgram API key"
                            }
                            value={transcriptionKeyInput}
                            onChange={(e) =>
                              setTranscriptionKeyInput(e.target.value)
                            }
                            className="h-9 pr-9 text-[13px]"
                            autoComplete="off"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0.5 top-1/2 size-7 -translate-y-1/2"
                            onClick={() => setShowTranscriptionKey((p) => !p)}
                            aria-label={
                              showTranscriptionKey ? "Hide key" : "Show key"
                            }
                          >
                            {showTranscriptionKey ? (
                              <EyeSlashIcon className="size-3.5" />
                            ) : (
                              <EyeIcon className="size-3.5" />
                            )}
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          className="h-9 text-[13px]"
                          onClick={async () => {
                            const trimmed = transcriptionKeyInput.trim();
                            if (!trimmed) {
                              toast.error("Please enter a Deepgram API key");
                              return;
                            }
                            try {
                              await saveTranscriptionByok.mutateAsync({
                                provider: "deepgram",
                                apiKey: trimmed,
                              });
                              setTranscriptionKeyInput("");
                              toast.success(
                                "Transcription BYOK (Deepgram) saved",
                              );
                            } catch (err) {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to save transcription key",
                              );
                            }
                          }}
                          disabled={
                            !transcriptionKeyInput.trim() ||
                            saveTranscriptionByok.isPending
                          }
                        >
                          {saveTranscriptionByok.isPending
                            ? "Saving..."
                            : "Save"}
                        </Button>
                      </div>
                      {aiConfigData?.config?.hasTranscriptionKey && (
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-muted-foreground">
                            Active: Deepgram — transcription uses your key
                          </span>
                          <Dialog
                            open={clearTranscriptionDialogOpen}
                            onOpenChange={setClearTranscriptionDialogOpen}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[12px] text-destructive hover:text-destructive"
                              >
                                Clear
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-sm">
                              <DialogHeader>
                                <DialogTitle>
                                  Clear transcription BYOK?
                                </DialogTitle>
                                <DialogDescription>
                                  Voice transcription will use the main AI key
                                  again.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setClearTranscriptionDialogOpen(false)
                                  }
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await saveTranscriptionByok.mutateAsync({
                                        provider: null,
                                        apiKey: "",
                                      });
                                      setClearTranscriptionDialogOpen(false);
                                      toast.success(
                                        "Transcription BYOK cleared",
                                      );
                                    } catch (err) {
                                      toast.error(
                                        err instanceof Error
                                          ? err.message
                                          : "Failed to clear",
                                      );
                                    }
                                  }}
                                >
                                  Clear
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t pt-6">
                  <h3 className="text-[13px] font-medium mb-1">Email (SMTP)</h3>
                  <p className="text-[12px] text-muted-foreground mb-3">
                    Only required if you&apos;re not using a BasicsOS key above.
                    With BasicsOS, we handle SMTP (email) for you — don&apos;t
                    worry! Configure your own SMTP here for password reset and
                    transactional emails when using BYOK.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
                    <Label className="pt-2 text-[12px] text-muted-foreground">
                      Host
                    </Label>
                    <Input
                      placeholder="smtp.resend.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="h-9 sm:max-w-[260px]"
                    />
                    <Label className="pt-2 text-[12px] text-muted-foreground">
                      Port
                    </Label>
                    <Input
                      type="number"
                      placeholder="587"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className="h-9 sm:max-w-[120px]"
                    />
                    <Label className="pt-2 text-[12px] text-muted-foreground">
                      User
                    </Label>
                    <Input
                      placeholder="resend"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      className="h-9 sm:max-w-[260px]"
                    />
                    <Label className="pt-2 text-[12px] text-muted-foreground">
                      Password
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1 max-w-[260px]">
                        <Input
                          type={showSmtpPassword ? "text" : "password"}
                          placeholder={
                            smtpConfigData?.config?.hasPassword
                              ? "•••••••• — enter new to replace"
                              : "SMTP password"
                          }
                          value={smtpPassword}
                          onChange={(e) => setSmtpPassword(e.target.value)}
                          className="h-9 pr-9"
                          autoComplete="off"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0.5 top-1/2 size-7 -translate-y-1/2"
                          onClick={() => setShowSmtpPassword((p) => !p)}
                          aria-label={
                            showSmtpPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showSmtpPassword ? (
                            <EyeSlashIcon className="size-3.5" />
                          ) : (
                            <EyeIcon className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Label className="pt-2 text-[12px] text-muted-foreground">
                      From (email)
                    </Label>
                    <Input
                      type="email"
                      placeholder="Basics <noreply@yourdomain.com>"
                      value={smtpFrom}
                      onChange={(e) => setSmtpFrom(e.target.value)}
                      className="h-9 sm:max-w-[260px]"
                    />
                    <div />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        className="h-9 text-[13px]"
                        onClick={async () => {
                          const host = smtpHost.trim();
                          const port = Number(smtpPort);
                          const user = smtpUser.trim();
                          const password = smtpPassword.trim();
                          const from = smtpFrom.trim();
                          if (!host || !user || !from) {
                            toast.error(
                              "Host, user, and from email are required",
                            );
                            return;
                          }
                          const hasExisting =
                            smtpConfigData?.config?.hasPassword;
                          if (!password.trim() && !hasExisting) {
                            toast.error("Password is required for new config");
                            return;
                          }
                          if (port < 1 || port > 65535) {
                            toast.error("Port must be 1–65535");
                            return;
                          }
                          if (!/@/.test(from)) {
                            toast.error(
                              "From must contain a valid email address",
                            );
                            return;
                          }
                          try {
                            await saveSmtpConfig.mutateAsync({
                              host,
                              port,
                              user,
                              ...(password.trim() && { password: password }),
                              fromEmail: from,
                            });
                            setSmtpPassword("");
                            toast.success("SMTP configuration saved");
                          } catch (err) {
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : "Failed to save SMTP config",
                            );
                          }
                        }}
                        disabled={saveSmtpConfig.isPending}
                      >
                        {saveSmtpConfig.isPending ? "Saving..." : "Save SMTP"}
                      </Button>
                      {smtpConfigData?.config?.hasPassword && (
                        <Dialog
                          open={clearSmtpDialogOpen}
                          onOpenChange={setClearSmtpDialogOpen}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 text-[12px] text-destructive hover:text-destructive"
                            >
                              Clear SMTP
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-sm">
                            <DialogHeader>
                              <DialogTitle>
                                Clear SMTP configuration?
                              </DialogTitle>
                              <DialogDescription>
                                Password reset emails will use the BasicsOS key
                                (if set) or env vars instead.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setClearSmtpDialogOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await clearSmtpConfig.mutateAsync();
                                    setClearSmtpDialogOpen(false);
                                    setSmtpHost("");
                                    setSmtpPort("587");
                                    setSmtpUser("");
                                    setSmtpPassword("");
                                    setSmtpFrom("");
                                    toast.success("SMTP configuration cleared");
                                  } catch (err) {
                                    toast.error(
                                      err instanceof Error
                                        ? err.message
                                        : "Failed to clear",
                                    );
                                  }
                                }}
                              >
                                Clear
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                    {smtpConfigData?.config && (
                      <div className="sm:col-span-2">
                        <span className="text-[12px] text-muted-foreground">
                          Active: {smtpConfigData.config.host}:
                          {smtpConfigData.config.port} — last updated{" "}
                          {new Date(
                            smtpConfigData.config.updatedAt,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {smtpConfigData?.hasEnvFallback &&
                      !smtpConfigData?.config && (
                        <div className="sm:col-span-2">
                          <p className="text-[12px] text-muted-foreground">
                            Using env fallback (
                            {smtpConfigData.hasEnvSmtp
                              ? "SMTP"
                              : smtpConfigData.hasEnvBasicsos
                                ? "BasicsOS key"
                                : "—"}
                            ). Set above to override.
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </section>
            </>
          )}

          {me?.administrator && (
            <>
              <Separator />
              <section id="organization" className={sectionClass}>
                <div className="mb-4">
                  <h2 className="text-[15px] font-semibold">Organization</h2>
                  <p className="text-[12px] text-muted-foreground">
                    Set workspace identity seen by your team.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Label
                    htmlFor="org-name"
                    className="pt-2 text-[12px] text-muted-foreground"
                  >
                    Organization name
                  </Label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="h-9 text-[13px]"
                  />
                  <Label
                    htmlFor="org-logo-url"
                    className="pt-2 text-[12px] text-muted-foreground"
                  >
                    Logo image URL
                  </Label>
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
                        <p className="text-[12px] text-muted-foreground">
                          Preview
                        </p>
                      </div>
                    )}
                  </div>
                  <div />
                  <div>
                    <Button
                      size="sm"
                      className="h-9 text-[13px]"
                      onClick={handleSaveOrganization}
                      disabled={savingOrg}
                    >
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
                  <p className="text-[12px] text-muted-foreground">
                    Issue secure invite tokens. Enter an email and optionally
                    send the invite link via your configured method (SMTP or
                    BasicsOS key).
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Label
                    htmlFor="invite-email"
                    className="pt-2 text-[12px] text-muted-foreground"
                  >
                    Recipient email (optional)
                  </Label>
                  <div className="space-y-2">
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="teammate@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="h-9 text-[13px]"
                    />
                    {inviteEmail.trim() && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="invite-send-email"
                          checked={inviteSendEmail}
                          onCheckedChange={(v) =>
                            setInviteSendEmail(v === true)
                          }
                        />
                        <Label
                          htmlFor="invite-send-email"
                          className="text-[12px] text-muted-foreground font-normal cursor-pointer"
                        >
                          Email invite using configured method (SMTP or BasicsOS
                          key)
                        </Label>
                      </div>
                    )}
                  </div>
                  <Label className="pt-2 text-[12px] text-muted-foreground">
                    Token expiry
                  </Label>
                  <Select
                    value={inviteExpiresInHours}
                    onValueChange={setInviteExpiresInHours}
                  >
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
                    <Button
                      size="sm"
                      className="h-9 text-[13px]"
                      onClick={handleCreateInvite}
                      disabled={creatingInvite}
                    >
                      {creatingInvite ? "Creating..." : "Create invite"}
                    </Button>
                  </div>
                </div>

                {inviteToken && (
                  <div className="mt-4 rounded-lg border bg-muted/20 p-3">
                    <div className="space-y-2">
                      <Label className="text-[12px] text-muted-foreground">
                        Invite code
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={inviteToken}
                          className="h-9 text-[12px]"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-[12px]"
                          onClick={() =>
                            copyText(inviteToken, "Invite code copied")
                          }
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label className="text-[12px] text-muted-foreground">
                        Signup link
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={signupLink}
                          className="h-9 text-[12px]"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-[12px]"
                          onClick={() =>
                            copyText(signupLink, "Signup link copied")
                          }
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
                  <h2 className="text-[15px] font-semibold">
                    Roles and Access
                  </h2>
                  <p className="text-[12px] text-muted-foreground">
                    Control who can manage settings and destructive actions.
                  </p>
                </div>
                <div className="space-y-3">
                  {(rbacUsers ?? []).map((user) => {
                    const selected =
                      roleDrafts[user.id] ?? user.roles[0]?.key ?? "";
                    const isSelf = user.id === me?.id;
                    return (
                      <div key={user.id} className="rounded-lg border p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-[13px] font-medium">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-[12px] text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={selected}
                              onValueChange={(value) =>
                                setRoleDrafts((prev) => ({
                                  ...prev,
                                  [user.id]: value,
                                }))
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
                              disabled={
                                isSelf ||
                                assignRole.isPending ||
                                !selected ||
                                selected === (user.roles[0]?.key ?? "")
                              }
                              onClick={async () => {
                                try {
                                  await assignRole.mutateAsync({
                                    crmUserId: user.id,
                                    roleKey: selected,
                                  });
                                  toast.success("Role updated");
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to update role",
                                  );
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
              <p className="text-[12px] text-muted-foreground">
                Connect Gmail and Slack for automation workflows.
              </p>
            </div>
            <ConnectionsContent embeddedInSettings />
            <EmailSyncSection isAdmin={isAdmin} />
          </section>

          <Separator />

          <section id="slack-bot" className={sectionClass}>
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold">Slack Bot</h2>
              <p className="text-[12px] text-muted-foreground">
                Configure a Slack bot to receive @mentions and respond from your CRM.
              </p>
            </div>
            {isAdmin ? (
              <div className="space-y-4 max-w-lg">
                {slackBotStatus?.configured && (
                  <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
                    <span className="text-[12px] text-green-700 dark:text-green-400">
                      Slack bot is configured and active
                    </span>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-[12px]">Bot Token</Label>
                  <div className="relative">
                    <Input
                      type={showSlackToken ? "text" : "password"}
                      placeholder={slackBotStatus?.hasToken ? "••••••••••••••••" : "xoxb-..."}
                      value={slackBotToken}
                      onChange={(e) => setSlackBotToken(e.target.value)}
                      className="h-8 pr-9 text-[12px]"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSlackToken((v) => !v)}
                    >
                      {showSlackToken ? <EyeSlashIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Signing Secret</Label>
                  <div className="relative">
                    <Input
                      type={showSlackSecret ? "text" : "password"}
                      placeholder={slackBotStatus?.hasSigningSecret ? "••••••••••••••••" : "Signing secret from Slack app settings"}
                      value={slackSigningSecret}
                      onChange={(e) => setSlackSigningSecret(e.target.value)}
                      className="h-8 pr-9 text-[12px]"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSlackSecret((v) => !v)}
                    >
                      {showSlackSecret ? <EyeSlashIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Team ID (optional)</Label>
                  <Input
                    type="text"
                    placeholder={slackBotStatus?.teamId ?? "T01234ABCDE"}
                    value={slackTeamId}
                    onChange={(e) => setSlackTeamId(e.target.value)}
                    className="h-8 text-[12px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Events webhook URL</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${API_URL}/api/slack/events`}
                      className="h-8 text-[12px] font-mono bg-muted"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 text-[12px]"
                      onClick={() => {
                        navigator.clipboard.writeText(`${API_URL}/api/slack/events`);
                        toast.success("Copied");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Paste this URL in your Slack app's Event Subscriptions settings.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-[12px]"
                  disabled={saveSlackBot.isPending || (!slackBotToken && !slackSigningSecret && !slackTeamId)}
                  onClick={() => {
                    saveSlackBot.mutate(
                      {
                        botToken: slackBotToken || undefined,
                        signingSecret: slackSigningSecret || undefined,
                        teamId: slackTeamId || undefined,
                      },
                      {
                        onSuccess: () => {
                          toast.success("Slack bot config saved");
                          setSlackBotToken("");
                          setSlackSigningSecret("");
                          setSlackTeamId("");
                        },
                        onError: () => toast.error("Failed to save Slack bot config"),
                      },
                    );
                  }}
                >
                  {saveSlackBot.isPending ? "Saving..." : "Save Slack bot config"}
                </Button>
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                Only administrators can configure the Slack bot.
              </p>
            )}
          </section>

          <Separator />

          <section id="onboarding" className={sectionClass}>
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold">Onboarding</h2>
              <p className="text-[12px] text-muted-foreground">
                Restart the onboarding flow to see the welcome guide again.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[12px]"
              onClick={() =>
                restartOnboarding().then(() => {
                  toast.success("Onboarding reset — taking you to the welcome guide");
                  void navigate("/home");
                })
              }
              disabled={isRestartingOnboarding}
            >
              {isRestartingOnboarding ? "Resetting..." : "Restart onboarding"}
            </Button>
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
                  {aiConfigDirty && isAdmin && (
                    <Button
                      size="sm"
                      className="h-8 text-[12px]"
                      onClick={handleSaveAiConfig}
                      disabled={!aiKeyInput.trim() || saveAiConfig.isPending}
                    >
                      Save AI config
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

function EmailSyncSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: syncStatus, isLoading } = useEmailSyncStatus();
  const startSync = useStartEmailSync();
  const updateSettings = useUpdateSyncSettings();
  const triggerSync = useTriggerSync();
  const stopSync = useStopEmailSync();
  const [confirmStop, setConfirmStop] = useState(false);
  const [dealCriteriaLocal, setDealCriteriaLocal] = useState("");

  useEffect(() => {
    setDealCriteriaLocal(syncStatus?.settings?.dealCriteriaText ?? "");
  }, [syncStatus?.settings?.dealCriteriaText]);

  if (isLoading) return null;

  const isActive = syncStatus?.syncStatus !== "not_started";
  const settings = syncStatus?.settings;

  if (!isActive) {
    return (
      <div className="mt-6 space-y-3 border-t pt-6">
        <div>
          <h3 className="text-[13px] font-medium">Email Sync</h3>
          <p className="text-xs text-muted-foreground">
            Sync emails from Gmail to discover contacts and link conversations.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() =>
            startSync.mutate(undefined, {
              onSuccess: () => toast.success("Email sync started"),
            })
          }
          disabled={startSync.isPending}
        >
          {startSync.isPending ? "Starting..." : "Enable Email Sync"}
        </Button>
      </div>
    );
  }

  const lastSynced = syncStatus?.lastSyncedAt
    ? new Date(syncStatus.lastSyncedAt).toLocaleString()
    : "Never";

  return (
    <div className="mt-6 space-y-4 border-t pt-6">
      <div>
        <h3 className="text-[13px] font-medium">Email Sync</h3>
        <p className="text-xs text-muted-foreground">
          {syncStatus?.syncStatus === "syncing"
            ? "Syncing..."
            : syncStatus?.syncStatus === "error"
              ? "Error — check logs"
              : `Active — last synced ${lastSynced}`}
          {syncStatus?.totalSynced
            ? ` · ${syncStatus.totalSynced.toLocaleString()} emails synced`
            : ""}
        </p>
      </div>

      <div className="space-y-3">
        {isAdmin && settings && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm">AI enrichment</Label>
                <p className="text-xs text-muted-foreground">
                  Enrich accepted contacts with job titles and phone numbers
                </p>
              </div>
              <Switch
                checked={settings.enrichWithAi}
                onCheckedChange={(checked) =>
                  updateSettings.mutate({ enrichWithAi: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm">Sync period</Label>
                <p className="text-xs text-muted-foreground">
                  How far back to sync emails
                </p>
              </div>
              <Select
                value={String(settings.syncPeriodDays)}
                onValueChange={(v) =>
                  updateSettings.mutate({ syncPeriodDays: parseInt(v, 10) })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">What counts as a deal (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Describe in plain language what you want the AI to treat as a
                potential deal (e.g. founder intros, partnership proposals,
                enterprise leads). Leave blank to use the default.
              </p>
              <Textarea
                placeholder="e.g. Introductions to founders, partnership proposals, enterprise sales leads"
                value={dealCriteriaLocal}
                onChange={(e) => setDealCriteriaLocal(e.target.value)}
                onBlur={() => {
                  const v = dealCriteriaLocal.trim() || null;
                  if (v !== (settings.dealCriteriaText ?? null))
                    updateSettings.mutate({ dealCriteriaText: v });
                }}
                className="min-h-[80px] resize-y"
              />
            </div>
          </>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              triggerSync.mutate(undefined, {
                onSuccess: () => toast.success("Sync triggered"),
              })
            }
            disabled={
              triggerSync.isPending || syncStatus?.syncStatus === "syncing"
            }
          >
            Sync Now
          </Button>
          {isAdmin && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => setConfirmStop(true)}
              >
                Stop Sync
              </Button>
              <Dialog open={confirmStop} onOpenChange={setConfirmStop}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Stop email sync?</DialogTitle>
                    <DialogDescription>
                      This will stop syncing emails. Existing synced emails and
                      contact links will be preserved.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setConfirmStop(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        stopSync.mutate(undefined, {
                          onSuccess: () => {
                            setConfirmStop(false);
                            toast.success("Email sync stopped");
                          },
                        })
                      }
                      disabled={stopSync.isPending}
                    >
                      {stopSync.isPending ? "Stopping..." : "Stop Sync"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

SettingsPage.path = "/settings";
