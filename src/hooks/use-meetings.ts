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
  } | null;
  createdAt: string;
}

export interface MeetingDetail extends Meeting {
  transcripts: MeetingTranscript[];
  summary: MeetingSummary | null;
}

export function useMeetings(params?: { page?: number; perPage?: number }) {
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 25;

  return useQuery({
    queryKey: ["meetings", { page, perPage }],
    queryFn: () =>
      fetchApi<Meeting[]>(`/api/meetings?page=${page}&perPage=${perPage}`),
  });
}

export function useMeeting(id: number | null) {
  return useQuery({
    queryKey: ["meetings", "detail", id],
    queryFn: () => fetchApi<MeetingDetail>(`/api/meetings/${id}`),
    enabled: id != null,
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
