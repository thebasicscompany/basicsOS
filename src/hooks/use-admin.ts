import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export interface OrgAiConfigResponse {
  config: {
    keyType: string;
    byokProvider: string | null;
    hasKey: boolean;
    updatedAt: string;
    hasTranscriptionKey: boolean;
    transcriptionByokProvider: string | null;
  } | null;
  hasEnvFallback: boolean;
  envFallbackType: string | null;
  envByokProvider: string | null;
}

export interface UsageLog {
  id: number;
  crmUserId: number;
  userName: string;
  feature: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number | null;
  createdAt: string;
}

export interface UsageSummaryByUser {
  crmUserId: number;
  userName: string;
  feature: string;
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDurationMs: number | null;
}

export interface UsageSummaryByDay {
  date: string;
  feature: string;
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDurationMs: number | null;
}

export interface UsageSummaryResponse {
  byUser: UsageSummaryByUser[];
  byDay: UsageSummaryByDay[];
  totals: {
    requestCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
  days: number;
}

export function useAdminAiConfig(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "ai-config"],
    queryFn: () => fetchApi<OrgAiConfigResponse>("/api/admin/ai-config"),
    enabled,
  });
}

export function useSaveAdminAiConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      keyType: string;
      byokProvider?: string | null;
      apiKey: string;
    }) =>
      fetchApi("/api/admin/ai-config", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ai-config"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useClearAdminAiConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchApi("/api/admin/ai-config", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ai-config"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useSaveAdminTranscriptionByok() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { provider: "deepgram" | null; apiKey: string }) =>
      fetchApi("/api/admin/ai-config/transcription", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ai-config"] });
    },
  });
}

export function useAdminUsageLogs(enabled: boolean, days = 30) {
  return useQuery({
    queryKey: ["admin", "usage", "logs", days],
    queryFn: () =>
      fetchApi<{ logs: UsageLog[] }>(
        `/api/admin/usage?days=${days}&limit=200`,
      ),
    enabled,
  });
}

export function useAdminUsageSummary(enabled: boolean, days = 30) {
  return useQuery({
    queryKey: ["admin", "usage", "summary", days],
    queryFn: () =>
      fetchApi<UsageSummaryResponse>(
        `/api/admin/usage/summary?days=${days}`,
      ),
    enabled,
  });
}
