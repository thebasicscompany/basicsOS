import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getList, getOne, create, update, remove, type ListParams } from "@/lib/api/crm";
import { mapRecords, snakeToCamel, unmapRecord } from "@/lib/crm/field-mapper";

export interface Deal {
  id: number;
  name: string;
  companyId: number | null;
  contactIds: number[] | null;
  category: string | null;
  stage: string;
  description: string | null;
  amount: number | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  expectedClosingDate: string | null;
  salesId: number | null;
  index: number | null;
  customFields?: Record<string, unknown>;
}

export function useDeals(params: ListParams = {}) {
  return useQuery({
    queryKey: ["deals", params],
    queryFn: async () => {
      const result = await getList<Record<string, unknown>>("deals", params);
      return { data: mapRecords(result.data) as Deal[], total: result.total };
    },
  });
}

export function useDeal(id: number | null) {
  return useQuery({
    queryKey: ["deals", id],
    queryFn: async () => snakeToCamel(await getOne<Record<string, unknown>>("deals", id!)) as Deal,
    enabled: id != null,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Deal>) => create<Deal>("deals", unmapRecord(data as Record<string, unknown>)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["companies_summary"] });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Deal> }) =>
      update<Deal>("deals", id, unmapRecord(data as Record<string, unknown>)),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals", id] });
      queryClient.invalidateQueries({ queryKey: ["companies_summary"] });
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => remove<Deal>("deals", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["companies_summary"] });
    },
  });
}
