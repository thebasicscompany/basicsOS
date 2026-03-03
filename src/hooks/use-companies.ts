import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getList, getOne, create, update, remove, type ListParams } from "@/lib/api/crm";
import { mapRecords, snakeToCamel, unmapRecord } from "@/lib/crm/field-mapper";

export interface CompanySummary {
  id: number;
  name: string;
  sector: string | null;
  size: number | null;
  website: string | null;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  stateAbbr: string | null;
  country: string | null;
  revenue: string | null;
  logo: { src: string } | null;
  linkedinUrl: string | null;
  description: string | null;
  createdAt: string | null;
  salesId: number | null;
  nbDeals: number;
  nbContacts: number;
  customFields?: Record<string, unknown>;
}

export interface Company extends Omit<CompanySummary, "nbDeals" | "nbContacts"> {
  customFields?: Record<string, unknown>;
}

export function useCompanies(params: ListParams = {}) {
  return useQuery({
    queryKey: ["companies_summary", params],
    queryFn: async () => {
      const result = await getList<Record<string, unknown>>("companies_summary", params);
      return { data: mapRecords(result.data) as CompanySummary[], total: result.total };
    },
  });
}

export function useCompany(id: number | null) {
  return useQuery({
    queryKey: ["companies", id],
    queryFn: async () => snakeToCamel(await getOne<Record<string, unknown>>("companies", id!)) as Company,
    enabled: id != null,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Company>) =>
      create<Company>("companies", unmapRecord(data as Record<string, unknown>)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies_summary"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Company> }) =>
      update<Company>("companies", id, unmapRecord(data as Record<string, unknown>)),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["companies_summary"] });
      queryClient.invalidateQueries({ queryKey: ["companies", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts_summary"] });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => remove<Company>("companies", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies_summary"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["contacts_summary"] });
    },
  });
}
