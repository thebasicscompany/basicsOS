import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

interface EnrichmentCredits {
  monthlyLimit: number;
  usedThisMonth: number;
}

export function useEnrich() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
    }: {
      entityType: "contact" | "company";
      entityId: number;
    }) => {
      return fetchApi("/api/enrichment/enrich", {
        method: "POST",
        body: JSON.stringify({ entityType, entityId }),
      });
    },
    onSuccess: (_data, variables) => {
      // Invalidate the record detail to refresh enriched data
      const slug =
        variables.entityType === "contact" ? "contacts" : "companies";
      queryClient.invalidateQueries({ queryKey: ["records", slug] });
      queryClient.invalidateQueries({
        queryKey: ["records", slug, "detail", variables.entityId],
      });
      queryClient.invalidateQueries({ queryKey: ["enrichment-credits"] });
    },
  });
}

export function useEnrichmentCredits() {
  return useQuery<EnrichmentCredits>({
    queryKey: ["enrichment-credits"],
    queryFn: async () => {
      return fetchApi("/api/enrichment/credits");
    },
  });
}
