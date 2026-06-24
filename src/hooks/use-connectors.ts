import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type ConnectorAuthScheme = "bearer" | "header" | "query" | "none";

export interface Connector {
  slug: string;
  name: string;
  baseUrl: string;
  description: string;
  authScheme: ConnectorAuthScheme;
  authName: string;
  hasKey: boolean;
}

export interface CreateConnectorPayload {
  name: string;
  baseUrl: string;
  description?: string;
  authScheme: ConnectorAuthScheme;
  authName?: string;
  apiKey?: string;
}

/** Custom external-API connectors (admin-managed). The key is never returned. */
export function useConnectors() {
  return useQuery({
    queryKey: ["connectors"],
    queryFn: async () =>
      (await fetchApi<{ connectors: Connector[] }>("/api/connectors")).connectors,
  });
}

export function useCreateConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateConnectorPayload) =>
      fetchApi<Connector>("/api/connectors", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connectors"] }),
  });
}

export function useDeleteConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) =>
      fetchApi(`/api/connectors/${slug}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connectors"] }),
  });
}
