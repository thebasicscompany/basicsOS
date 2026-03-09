import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getList, create, update, remove } from "@/lib/api/crm";

export interface Note {
  id: number;
  title: string | null;
  text: string | null;
  date: string;
  crmUserId: number | null;
  contactId?: number;
  dealId?: number;
  companyId?: number;
  status?: string | null;
}

const SLUG_TO_RESOURCE: Record<string, string> = {
  contacts: "contact_notes",
  companies: "company_notes",
  deals: "deal_notes",
};

const SLUG_TO_FK: Record<string, string> = {
  contacts: "contactId",
  companies: "companyId",
  deals: "dealId",
};

function getResource(objectSlug: string) {
  return SLUG_TO_RESOURCE[objectSlug];
}

function getFkField(objectSlug: string) {
  return SLUG_TO_FK[objectSlug];
}

export function useNotes(objectSlug: string, recordId: number | null) {
  const resource = getResource(objectSlug);
  const fk = getFkField(objectSlug);

  return useQuery({
    queryKey: ["notes", objectSlug, recordId],
    queryFn: () =>
      getList<Note>(resource, {
        filter: {
          [fk.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)]: recordId,
        },
        sort: { field: "date", order: "DESC" },
        pagination: { page: 1, perPage: 100 },
      }),
    enabled: recordId != null && !!resource,
  });
}

export function useCreateNote(objectSlug: string) {
  const queryClient = useQueryClient();
  const resource = getResource(objectSlug);
  const fk = getFkField(objectSlug);

  return useMutation({
    mutationFn: (data: { recordId: number; title?: string; text?: string }) =>
      create<Note>(resource, {
        [fk]: data.recordId,
        title: data.title ?? null,
        text: data.text ?? "",
        date: new Date().toISOString(),
      }),
    onSuccess: (_, { recordId }) => {
      queryClient.invalidateQueries({
        queryKey: ["notes", objectSlug, recordId],
      });
      // Also invalidate legacy keys
      const legacyKey = resource.replace("_", "_");
      queryClient.invalidateQueries({ queryKey: [legacyKey] });
    },
  });
}

export function useUpdateNote(objectSlug: string) {
  const queryClient = useQueryClient();
  const resource = getResource(objectSlug);

  return useMutation({
    mutationFn: ({
      id,
      recordId: _recordId,
      ...data
    }: {
      id: number;
      recordId: number;
      title?: string;
      text?: string;
    }) => update<Note>(resource, id, data),
    onSuccess: (_, { recordId }) => {
      queryClient.invalidateQueries({
        queryKey: ["notes", objectSlug, recordId],
      });
    },
  });
}

export function useDeleteNote(objectSlug: string) {
  const queryClient = useQueryClient();
  const resource = getResource(objectSlug);

  return useMutation({
    mutationFn: ({ id }: { id: number; recordId: number }) =>
      remove<Note>(resource, id),
    onSuccess: (_, { recordId }) => {
      queryClient.invalidateQueries({
        queryKey: ["notes", objectSlug, recordId],
      });
    },
  });
}
