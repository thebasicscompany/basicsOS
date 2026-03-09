import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type {
  EmailSyncStatus,
  SuggestedContact,
  SyncedEmail,
  EmailSyncSettings,
  EmailParticipant,
} from "@/types/email-sync";

// ─── Status ────────────────────────────────────────────────────────

export function useEmailSyncStatus() {
  return useQuery({
    queryKey: ["email-sync", "status"],
    queryFn: () => fetchApi<EmailSyncStatus>("/api/email-sync/status"),
    staleTime: 30_000,
  });
}

// ─── Suggestions ───────────────────────────────────────────────────

export function useSuggestedContacts(params?: {
  status?: string;
  page?: number;
  perPage?: number;
}) {
  const status = params?.status ?? "pending";
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;

  return useQuery({
    queryKey: ["email-sync", "suggestions", { status, page, perPage }],
    queryFn: () =>
      fetchApi<{
        data: SuggestedContact[];
        total: number;
        page: number;
        perPage: number;
      }>(
        `/api/email-sync/suggestions?status=${status}&page=${page}&perPage=${perPage}`,
      ),
  });
}

// ─── Contact Emails ────────────────────────────────────────────────

export function useContactEmails(
  contactId: number | undefined,
  params?: { page?: number; perPage?: number },
) {
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;

  return useQuery({
    queryKey: ["email-sync", "emails", contactId, { page, perPage }],
    queryFn: () =>
      fetchApi<{
        data: SyncedEmail[];
        total: number;
        page: number;
        perPage: number;
      }>(
        `/api/email-sync/emails?contactId=${contactId}&page=${page}&perPage=${perPage}`,
      ),
    enabled: !!contactId,
  });
}

export function useEmailDetail(emailId: number | undefined) {
  return useQuery({
    queryKey: ["email-sync", "emails", "detail", emailId],
    queryFn: () => fetchApi<SyncedEmail>(`/api/email-sync/emails/${emailId}`),
    enabled: !!emailId,
  });
}

// ─── Email Search ─────────────────────────────────────────────────

export function useEmailSearch(query: string) {
  return useQuery({
    queryKey: ["email-sync", "search", query],
    queryFn: () =>
      fetchApi<{ data: EmailParticipant[] }>(
        `/api/email-sync/search?q=${encodeURIComponent(query)}`,
      ),
    enabled: query.length >= 2,
    staleTime: 60_000,
  });
}

export function useAddContactFromEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      email: string;
      firstName?: string;
      lastName?: string;
      domain?: string;
    }) =>
      fetchApi<{ ok: boolean; contactId: number }>(
        "/api/email-sync/add-contact",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-sync", "search"] });
      qc.invalidateQueries({ queryKey: ["email-sync", "suggestions"] });
      qc.invalidateQueries({ queryKey: ["email-sync", "status"] });
      qc.invalidateQueries({ queryKey: ["records", "contacts"] });
      qc.invalidateQueries({ queryKey: ["contacts_summary"] });
    },
  });
}

// ─── Mutations ─────────────────────────────────────────────────────

export function useStartEmailSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchApi<{ ok: boolean }>("/api/email-sync/start", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-sync", "status"] });
    },
  });
}

export function useAcceptSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchApi<{ ok: boolean; contactId: number }>(
        `/api/email-sync/suggestions/${id}/accept`,
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-sync", "suggestions"] });
      qc.invalidateQueries({ queryKey: ["email-sync", "status"] });
      qc.invalidateQueries({ queryKey: ["records", "contacts"] });
      qc.invalidateQueries({ queryKey: ["contacts_summary"] });
      qc.invalidateQueries({ queryKey: ["records", "companies"] });
      qc.invalidateQueries({ queryKey: ["companies_summary"] });
    },
  });
}

export function useDismissSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchApi<{ ok: boolean }>(`/api/email-sync/suggestions/${id}/dismiss`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-sync", "suggestions"] });
      qc.invalidateQueries({ queryKey: ["email-sync", "status"] });
    },
  });
}

export function useAcceptAllSuggestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (minScore?: number) =>
      fetchApi<{ ok: boolean; accepted: number }>(
        "/api/email-sync/suggestions/accept-all",
        {
          method: "POST",
          body: JSON.stringify({ minScore: minScore ?? 0 }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-sync", "suggestions"] });
      qc.invalidateQueries({ queryKey: ["email-sync", "status"] });
      qc.invalidateQueries({ queryKey: ["records", "contacts"] });
      qc.invalidateQueries({ queryKey: ["contacts_summary"] });
      qc.invalidateQueries({ queryKey: ["records", "companies"] });
      qc.invalidateQueries({ queryKey: ["companies_summary"] });
    },
  });
}

export function useUpdateSyncSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<EmailSyncSettings>) =>
      fetchApi<{ ok: boolean; settings: EmailSyncSettings }>(
        "/api/email-sync/settings",
        {
          method: "PUT",
          body: JSON.stringify(settings),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-sync", "status"] });
    },
  });
}

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchApi<{ ok: boolean }>("/api/email-sync/trigger", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-sync", "status"] });
    },
  });
}

export function useStopEmailSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchApi<{ ok: boolean }>("/api/email-sync", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-sync", "status"] });
    },
  });
}
