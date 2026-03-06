import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export interface Thread {
  id: string;
  title: string | null;
  channel: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadMessage {
  id: number;
  role: string;
  content: string | null;
  createdAt: string;
}

export function useThreads(limit = 20) {
  return useQuery({
    queryKey: ["threads", limit],
    queryFn: () => fetchApi<Thread[]>(`/api/threads?limit=${limit}`),
  });
}

export function useThreadMessages(threadId: string | undefined) {
  return useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: () =>
      fetchApi<ThreadMessage[]>(`/api/threads/${threadId}/messages`),
    enabled: !!threadId,
  });
}
