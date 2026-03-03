"use client";

import { useEffect } from "react";
import { useSearchParams } from "react-router";
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
  { id: "slack", name: "Slack", description: "Send messages to channels and DMs" },
  { id: "google", name: "Gmail", description: "Read and send emails from your Google account" },
] as const;

import { usePageTitle } from "@/contexts/page-header";

export function ConnectionsPage() {
  usePageTitle("Connections");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { hasKey } = useGateway();

  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) {
      const name = connected.charAt(0).toUpperCase() + connected.slice(1);
      toast.success(`${name} connected!`);
      setSearchParams({}, { replace: true });
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: ["connections"],
    queryFn: () =>
      fetch(`${API_URL}/api/connections`, { credentials: "include" }).then(
        (r) => (r.ok ? r.json() : []),
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

  return (
    <div className="flex h-full flex-col overflow-auto py-4">
      <p className="mb-4 text-[12px] text-muted-foreground">Connect services to use in your automations.</p>

      {!hasKey && (
        <div className="mb-4 rounded-md border border-border bg-muted/50 p-3 text-[13px] text-muted-foreground">
          Add your Basics API key in{" "}
          <a href="/settings" className="font-medium text-foreground underline">Settings</a>{" "}
          to use connections.
        </div>
      )}

      <div className="grid max-w-lg gap-3 sm:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const conn = getConnection(provider.id);
          return (
            <div key={provider.id} className="flex flex-col gap-3 rounded-lg border p-3">
              <div>
                <p className="text-[13px] font-medium">{provider.name}</p>
                <p className="text-[11px] text-muted-foreground">{provider.description}</p>
              </div>
              {conn ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    <span className="text-[11px] text-muted-foreground">{conn.accountName ?? "Connected"}</span>
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
