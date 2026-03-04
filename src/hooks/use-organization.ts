import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export interface OrganizationInfo {
  id: string;
  name: string;
  logo: { src: string } | null;
}

export function useOrganization() {
  return useQuery({
    queryKey: ["organization"],
    queryFn: () => fetchApi<OrganizationInfo>("/api/organization"),
  });
}
