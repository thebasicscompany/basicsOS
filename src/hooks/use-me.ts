import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export interface Identity {
  id: number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  administrator?: boolean;
  hasApiKey?: boolean;
  hasOrgAiConfig?: boolean;
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => fetchApi<Identity>("/api/me"),
  });
}
