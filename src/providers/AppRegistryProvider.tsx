import { useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { getRuntimeApiUrl } from "@/lib/runtime-config";
import type { AppConfig } from "@/types/apps";
import {
  AppRegistryContext,
  type AppRegistryContextValue,
} from "./app-registry-context";

/**
 * Loads the company's custom apps from GET /api/app-config and exposes them to
 * the sidebar + the /apps/:slug runtime host. Mirrors ObjectRegistryProvider but
 * far simpler — apps are pure config (no schema-column merge).
 *
 * The sidebar shows only `active` apps (what every user can use); admins still
 * receive non-active rows in `allApps` so the builder can preview an unpublished
 * app at /apps/:slug. A publish (APP-3) invalidates the ["app-config"] query (and,
 * for other users' open shells, an apps/list_changed SSE) to surface it live.
 */
export function AppRegistryProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const {
    data: rawApps,
    isLoading,
    error,
  } = useQuery<AppConfig[]>({
    queryKey: ["app-config"],
    queryFn: () => fetchApi<AppConfig[]>("/api/app-config"),
  });

  // Live registry: refetch when the server pushes apps/list_changed (a publish or
  // suspend), so a newly published app appears in the sidebar within seconds —
  // the apps analog of the broker's tools/list_changed (no refresh, no rebuild).
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${getRuntimeApiUrl()}/api/app-config/stream`, {
        withCredentials: true,
      });
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as { type?: string };
          if (data?.type === "apps/list_changed") {
            qc.invalidateQueries({ queryKey: ["app-config"] });
          }
        } catch {
          /* ignore keepalive/non-JSON frames */
        }
      };
      // The browser auto-reconnects on error; nothing to do here.
    } catch {
      /* EventSource unavailable (e.g. SSR) — fall back to query refetch */
    }
    return () => es?.close();
  }, [qc]);

  const contextValue = useMemo<AppRegistryContextValue>(() => {
    const allApps = rawApps ?? [];
    const apps = allApps.filter((a) => a.status === "active");
    const appMap = new Map<string, AppConfig>();
    for (const a of allApps) appMap.set(a.slug, a);

    return {
      apps,
      allApps,
      getApp: (slug: string) => appMap.get(slug),
      isLoading,
      error: (error as Error | null) ?? null,
    };
  }, [rawApps, isLoading, error]);

  return (
    <AppRegistryContext.Provider value={contextValue}>
      {children}
    </AppRegistryContext.Provider>
  );
}
