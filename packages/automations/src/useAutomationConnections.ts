import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "basics-os/src/lib/api";

interface Connection {
  provider: string;
  accountName?: string;
  connectedAt?: string;
}

/** Fetches connections for the current user. Used to gate connection-dependent nodes. */
export function useAutomationConnections(enabled = true) {
  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: ["connections"],
    queryFn: async () => {
      try {
        return await fetchApi<Connection[]>("/api/connections");
      } catch {
        return [];
      }
    },
    enabled,
  });
  const connectedProviders = connections.map((c) => c.provider);
  return { connections, connectedProviders };
}
