import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ObjectRegistryContext,
  type ObjectRegistryContextValue,
} from "@/providers/object-registry-context";
import { fetchApi } from "@/lib/api";
import type { Attribute, ObjectConfig } from "@/types/objects";

/** Payload for updating object config (partial). */
export interface UpdateObjectConfigPayload {
  singularName?: string;
  pluralName?: string;
  icon?: string;
  iconColor?: string;
  tableName?: string;
  type?: string;
  isActive?: boolean;
  position?: number;
  settings?: Record<string, unknown>;
}

/**
 * Access the full ObjectRegistry context.
 */
export function useObjectRegistry(): ObjectRegistryContextValue {
  return useContext(ObjectRegistryContext);
}

/**
 * Get all registered (active) objects.
 */
export function useObjects(): ObjectConfig[] {
  const { objects } = useObjectRegistry();
  return objects;
}

/**
 * Get a single object config by slug.
 */
export function useObject(slug: string): ObjectConfig | undefined {
  const { getObject } = useObjectRegistry();
  return getObject(slug);
}

/**
 * Get the merged attribute list for an object (NocoDB columns + overrides).
 */
export function useAttributes(slug: string): Attribute[] {
  const { getAttributes } = useObjectRegistry();
  return getAttributes(slug);
}

/**
 * Update object config by slug (PUT /api/object-config/:slug).
 * Invalidates object-config and columns queries on success.
 */
export function useUpdateObjectConfig(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateObjectConfigPayload) =>
      fetchApi<ObjectConfig>(`/api/object-config/${slug}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["object-config"] });
      qc.invalidateQueries({ queryKey: ["columns"] });
    },
  });
}

export interface UpsertAttributeOverridePayload {
  columnName: string;
  displayName?: string;
  uiType?: string;
  icon?: string;
  isPrimary?: boolean;
  isHiddenByDefault?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Upsert an attribute override for a built-in schema column.
 * POST /api/object-config/:slug/overrides
 */
export function useUpsertAttributeOverride(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertAttributeOverridePayload) =>
      fetchApi(`/api/object-config/${slug}/overrides`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["object-config"] });
      qc.invalidateQueries({ queryKey: ["columns"] });
      qc.invalidateQueries({ queryKey: ["records"] });
    },
  });
}
