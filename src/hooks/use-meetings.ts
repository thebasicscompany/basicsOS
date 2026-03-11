import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export interface Meeting {
  id: number;
  organizationId: string | null;
  crmUserId: number | null;
  title: string | null;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingTranscript {
  id: number;
  meetingId: number;
  speaker: string | null;
  text: string | null;
  timestampMs: number | null;
}

export interface MeetingSummary {
  id: number;
  meetingId: number;
  summaryJson: {
    title?: string;
    note?: string;
    decisions?: string[];
    actionItems?: string[];
    followUps?: string[];
    _reviewed?: boolean;
  } | null;
  createdAt: string;
}

export interface MeetingLink {
  contacts: { id: number; name: string }[];
}

export interface MeetingWithSummary extends Meeting {
  summary: MeetingSummary | null;
}

export interface MeetingDetail extends Meeting {
  transcripts: MeetingTranscript[];
  summary: MeetingSummary | null;
  links: MeetingLink;
}

export function useMeetings(params?: { page?: number; perPage?: number }) {
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 25;

  return useQuery({
    queryKey: ["meetings", { page, perPage }],
    queryFn: () =>
      fetchApi<Meeting[]>(`/api/meetings?page=${page}&perPage=${perPage}`),
    // List is invalidated via IPC when overlay saves a meeting
  });
}

export function useMeeting(id: number | null) {
  return useQuery({
    queryKey: ["meetings", "detail", id],
    queryFn: () => fetchApi<MeetingDetail>(`/api/meetings/${id}`),
    enabled: id != null,
    // Poll while meeting is still processing so summary appears automatically
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "recording" || status === "processing" ? 3_000 : false;
    },
  });
}

export function useUpdateMeetingNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      fetchApi<{ ok: boolean }>(`/api/meetings/${id}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["meetings", "detail", vars.id],
      });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetchApi<{ ok: boolean }>(`/api/meetings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

// ─── Meeting Links (F2) ──────────────────────────────────────────

export function useMeetingsByRecord(params: { contactId?: number }) {
  const qs = new URLSearchParams();
  if (params.contactId) qs.set("contactId", String(params.contactId));

  return useQuery({
    queryKey: ["meetings", "by-record", params],
    queryFn: () =>
      fetchApi<MeetingWithSummary[]>(
        `/api/meetings/by-record?${qs.toString()}`,
      ),
    enabled: !!params.contactId,
  });
}

export function useLinkMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      meetingId,
      contactId,
    }: {
      meetingId: number;
      contactId: number;
    }) =>
      fetchApi<{ ok: boolean }>(`/api/meetings/${meetingId}/links`, {
        method: "POST",
        body: JSON.stringify({ contactId }),
      }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["meetings", "detail", vars.meetingId],
      });
      queryClient.invalidateQueries({ queryKey: ["meetings", "by-record"] });
    },
  });
}

export function useUnlinkMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      meetingId,
      contactId,
    }: {
      meetingId: number;
      contactId: number;
    }) =>
      fetchApi<{ ok: boolean }>(`/api/meetings/${meetingId}/links`, {
        method: "DELETE",
        body: JSON.stringify({ contactId }),
      }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["meetings", "detail", vars.meetingId],
      });
      queryClient.invalidateQueries({ queryKey: ["meetings", "by-record"] });
    },
  });
}

// ─── Action Items Review (F3) ────────────────────────────────────

export function useMarkActionItemsReviewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (meetingId: number) =>
      fetchApi<{ ok: boolean }>(
        `/api/meetings/${meetingId}/action-items-reviewed`,
        { method: "POST" },
      ),
    onSuccess: (_data, meetingId) => {
      queryClient.invalidateQueries({
        queryKey: ["meetings", "detail", meetingId],
      });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}
