"use client";

import { SlackLogoIcon, GoogleLogoIcon } from "@phosphor-icons/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useGateway } from "@/hooks/useGateway";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface Connection {
  provider: string;
  accountName?: string;
  accountAvatar?: string;
  connectedAt?: string;
  scopes?: string;
}

const PROVIDERS = [
  {
    id: "slack",
    name: "Slack",
    description: "Send messages to channels and DMs",
    icon: SlackLogoIcon,
    iconColor: "text-[#4A154B]",
  },
  {
    id: "google",
    name: "Gmail",
    description: "Read and send emails from your Google account",
    icon: GoogleLogoIcon,
    iconColor: "text-red-500",
  },
] as const;

export function ConnectionsContent({
  compact,
  embeddedInSettings,
}: {
  compact?: boolean;
  /** When true, shown inside Settings — avoids "Add API key in Settings" (redundant) */
  embeddedInSettings?: boolean;
}) {
  const queryClient = useQueryClient();
  const { hasKey } = useGateway();

  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: ["connections"],
    queryFn: () =>
      fetch(`${API_URL}/api/connections`, { credentials: "include" }).then((r) =>
        r.ok ? r.json() : [],
      ),
    enabled: hasKey,
  });

  const disconnectMutation = useMutation({
    mutationFn: (provider: string) =>
      fetch(`${API_URL}/api/connections/${provider}`, {
        method: "DELETE",
        credentials: "include",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      toast.success("Disconnected");
    },
    onError: () => toast.error("Failed to disconnect"),
  });

  const handleConnect = (provider: string) => {
    window.location.href = `${API_URL}/api/connections/${provider}/authorize`;
  };

  const getConnection = (providerId: string) =>
    connections.find((c) => c.provider === providerId);

  if (compact) {
    return (
      <div className="space-y-2 px-3 py-2">
        <p className="text-[11px] text-muted-foreground">
          Connect Gmail and Slack for automation nodes.
        </p>
        <div className="space-y-1">
          {PROVIDERS.map((provider) => {
            const conn = getConnection(provider.id);
            const Icon = provider.icon;
            return (
              <div
                key={provider.id}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`size-4 shrink-0 ${provider.iconColor}`} />
                  <span className="text-xs font-medium">{provider.name}</span>
                </div>
                {conn ? (
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[11px]"
                      onClick={() => disconnectMutation.mutate(provider.id)}
                      disabled={disconnectMutation.isPending}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 px-2 text-[11px]"
                    onClick={() => handleConnect(provider.id)}
                    disabled={!hasKey}
                  >
                    Connect
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {!hasKey && (
          <p className="text-[10px] text-muted-foreground">
            Add API key in <a href="/settings" className="underline">Settings</a> to connect.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto py-4">
      {!hasKey && (
        <div className="mb-4 rounded-md border border-border bg-muted/50 p-3 text-[13px] text-muted-foreground">
          {embeddedInSettings ? (
            "Add your API key above to unlock connections."
          ) : (
            <>
              Add your Basics API key in{" "}
              <a href="/settings" className="font-medium text-foreground underline">
                Settings
              </a>{" "}
              to use connections.
            </>
          )}
        </div>
      )}

      <div
        className={`grid max-w-lg gap-3 sm:grid-cols-2 ${!hasKey ? "pointer-events-none opacity-50" : ""}`}
      >
        {PROVIDERS.map((provider) => {
          const conn = getConnection(provider.id);
          const Icon = provider.icon;
          return (
            <div key={provider.id} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <Icon className={`mt-0.5 size-5 shrink-0 ${provider.iconColor}`} />
                <div>
                  <p className="text-[13px] font-medium">{provider.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {provider.description}
                  </p>
                </div>
              </div>
              {conn ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    <span className="text-[11px] text-muted-foreground">
                      {conn.accountName ?? "Connected"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[12px]"
                    onClick={() => disconnectMutation.mutate(provider.id)}
                    disabled={disconnectMutation.isPending}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[13px]"
                  onClick={() => handleConnect(provider.id)}
                  disabled={!hasKey}
                >
                  Connect
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
