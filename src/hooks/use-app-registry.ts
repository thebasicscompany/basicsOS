import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AppRegistryContext,
  type AppRegistryContextValue,
} from "@/providers/app-registry-context";
import { fetchApi } from "@/lib/api";
import type { AppConfig } from "@/types/apps";

/** Access the full app-registry context. */
export function useAppRegistry(): AppRegistryContextValue {
  return useContext(AppRegistryContext);
}

/** All active apps (for the sidebar). */
export function useApps(): AppConfig[] {
  return useAppRegistry().apps;
}

/** A single app by slug (active or, for admins, a previewable draft). */
export function useApp(slug: string): AppConfig | undefined {
  return useAppRegistry().getApp(slug);
}

export interface CreateAppPayload {
  name: string;
  icon?: string;
  iconColor?: string;
  type?: "declarative" | "hosted";
  spec?: Record<string, unknown>;
  permissions?: string[];
}

/** Create an app (admins only). POST /api/app-config. */
export function useCreateApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAppPayload) =>
      fetchApi<AppConfig>("/api/app-config", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-config"] });
    },
  });
}

export interface UpdateAppPayload {
  name?: string;
  icon?: string;
  iconColor?: string;
  type?: "declarative" | "hosted";
  status?: "draft" | "preview" | "scanning" | "active" | "suspended";
  spec?: Record<string, unknown> | unknown[];
  permissions?: string[];
  backendModule?: { slug: string; version: string } | null;
  version?: string;
  position?: number;
}

/** Update an app by slug (admins only). PUT /api/app-config/:slug. */
export function useUpdateApp(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAppPayload) =>
      fetchApi<AppConfig>(`/api/app-config/${slug}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-config"] });
    },
  });
}

/** Delete an app (admins only). DELETE /api/app-config/:slug. */
export function useDeleteApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) =>
      fetchApi<{ ok: boolean; slug: string }>(`/api/app-config/${slug}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-config"] });
    },
  });
}
