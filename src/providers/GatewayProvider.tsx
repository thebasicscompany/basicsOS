import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { createManageClient } from "@/lib/gateway";
import { GatewayContext, type GatewayContextValue } from "./gateway-context";
import { useMe } from "@/hooks/use-me";
import { getRuntimeApiUrl } from "@/lib/runtime-config";
const API_URL = getRuntimeApiUrl();
const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ?? "https://api.basicsos.com";

export function GatewayProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? null;

  const { data: me } = useMe();
  const hasServerKey = Boolean(me?.hasOrgAiConfig) || Boolean(me?.hasApiKey);

  const [manageToken, setManageToken] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setManageToken(null);
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/api/gateway-token`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { token?: string } | null) => {
        if (!cancelled && data?.token) setManageToken(data.token);
      })
      .catch(() => {
        if (!cancelled) setManageToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setApiKey = useCallback((_key: string) => {}, []);

  const clearApiKey = useCallback(() => {}, []);

  const manageClient = useMemo(() => {
    if (!manageToken) return null;
    return createManageClient(manageToken, GATEWAY_URL);
  }, [manageToken]);

  const value: GatewayContextValue = useMemo(
    () => ({
      apiKey: null,
      hasKey: hasServerKey,
      setApiKey,
      clearApiKey,
      apiClient: null,
      manageClient,
      gatewayUrl: GATEWAY_URL,
    }),
    [hasServerKey, setApiKey, clearApiKey, manageClient],
  );

  return (
    <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>
  );
}
