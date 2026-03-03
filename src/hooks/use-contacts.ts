import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getList, getOne, create, update, remove, type ListParams } from "@/lib/api/crm";
import { mapRecords, snakeToCamel, unmapRecord } from "@/lib/crm/field-mapper";

export interface ContactSummary {
  id: number;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  title: string | null;
  email: string | null;
  emailJsonb: { email: string; type: string }[] | null;
  phoneJsonb: { number: string; type: string }[] | null;
  status: string | null;
  avatar: { src: string } | null;
  background: string | null;
  companyId: number | null;
  companyName: string | null;
  nbTasks: number;
  firstSeen: string | null;
  lastSeen: string | null;
  hasNewsletter: boolean | null;
  linkedinUrl: string | null;
  tags: number[] | null;
  salesId: number | null;
  customFields?: Record<string, unknown>;
}

export interface Contact extends Omit<ContactSummary, "companyName" | "nbTasks"> {
  customFields?: Record<string, unknown>;
}

export function useContacts(params: ListParams = {}) {
  return useQuery({
    queryKey: ["contacts_summary", params],
    queryFn: async () => {
      const result = await getList<Record<string, unknown>>("contacts_summary", params);
      return { data: mapRecords(result.data) as ContactSummary[], total: result.total };
    },
  });
}

export function useContact(id: number | null) {
  return useQuery({
    queryKey: ["contacts", id],
    queryFn: async () => snakeToCamel(await getOne<Record<string, unknown>>("contacts", id!)) as Contact,
    enabled: id != null,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Contact>) =>
      create<Contact>("contacts", unmapRecord(data as Record<string, unknown>)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts_summary"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["companies_summary"] });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Contact> }) =>
      update<Contact>("contacts", id, unmapRecord(data as Record<string, unknown>)),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["contacts_summary"] });
      queryClient.invalidateQueries({ queryKey: ["contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["companies_summary"] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => remove<Contact>("contacts", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts_summary"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["companies_summary"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
