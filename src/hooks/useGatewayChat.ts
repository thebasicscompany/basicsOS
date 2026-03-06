import { useChat, type Message } from "@ai-sdk/react";
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const TOOL_TO_QUERY_KEYS: Record<string, string[]> = {
  search_contacts: ["contacts_summary"],
  get_contact: ["contacts_summary"],
  create_contact: ["contacts_summary"],
  update_contact: ["contacts_summary"],
  search_deals: ["deals"],
  get_deal: ["deals"],
  create_deal: ["deals"],
  update_deal: ["deals"],
  search_companies: ["companies_summary"],
  create_company: ["companies_summary"],
  list_tasks: ["tasks"],
  create_task: ["tasks"],
  complete_task: ["tasks"],
  list_notes: ["contact_notes"],
  create_note: ["contact_notes"],
};

interface UseGatewayChatOptions {
  initialThreadId?: string;
  initialMessages?: Message[];
}

/**
 * useChat hook for the Hub chat page, using the Gateway proxy.
 * Uses Better Auth session + API key, while tool execution runs server-side.
 */
export function useGatewayChat(opts?: UseGatewayChatOptions) {
  const queryClient = useQueryClient();
  const [threadId, setThreadId] = useState<string | undefined>(
    opts?.initialThreadId,
  );
  const pendingToolsRef = useRef<Set<string>>(new Set());

  const fetchWithErrorHandling = useCallback(
    async (url: string | URL | Request, init?: RequestInit) => {
      const res = await fetch(url, {
        ...init,
        credentials: "include",
      });
      if (
        !res.ok &&
        res.headers.get("content-type")?.includes("application/json")
      ) {
        const json = (await res.json()) as { error?: string; code?: string };
        const err = new Error(json.error ?? `HTTP ${res.status}`);
        (err as Error & { status?: number; code?: string }).status = res.status;
        (err as Error & { status?: number; code?: string }).code = json.code;
        throw err;
      }
      return res;
    },
    [],
  );

  const handleError = useCallback((error: Error) => {
    const message = error.message ?? String(error);
    const status = (error as Error & { status?: number }).status;
    const code = (error as Error & { code?: string }).code;
    if (status === 401 || message.includes("Invalid or expired token")) {
      toast.error("Please log in again");
    } else if (
      status === 400 ||
      message.includes("API key not configured") ||
      code === "invalid_api_key"
    ) {
      toast.error("Add your Basics API key in Settings to use the assistant");
    } else if (code === "billing_canceled" || code === "billing_delinquent") {
      toast.error("Billing issue. Check your Basics subscription.");
    } else if (code === "rate_limit_exceeded" || code === "quota_exceeded") {
      toast.error("Rate limit exceeded. Try again later.");
    } else if (status === 502 || message.includes("AI service")) {
      toast.error("AI service temporarily unavailable");
    } else {
      toast.error(message.slice(0, 100));
    }
  }, []);

  const handleFinish = useCallback(() => {
    const names = pendingToolsRef.current;
    if (names.size === 0) {
      // Fallback: server may mutate several entities via tools; keep UI fresh.
      queryClient.invalidateQueries({ queryKey: ["contacts_summary"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["companies_summary"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["contact_notes"] });
      return;
    }
    for (const name of names) {
      const keys = TOOL_TO_QUERY_KEYS[name];
      if (keys) {
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
    }
    pendingToolsRef.current = new Set();
  }, [queryClient]);

  const chat = useChat({
    api: `${API_URL}/api/gateway-chat`,
    body: { threadId, channel: "chat" },
    initialMessages: opts?.initialMessages,
    fetch: fetchWithErrorHandling,
    maxSteps: 5,
    onResponse: (response) => {
      const nextThreadId = response.headers.get("X-Thread-Id");
      if (nextThreadId) setThreadId(nextThreadId);
      const toolsUsed = response.headers.get("X-Tools-Used");
      if (toolsUsed) {
        pendingToolsRef.current = new Set(
          toolsUsed
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
        );
      } else {
        pendingToolsRef.current = new Set();
      }
    },
    onFinish: () => {
      handleFinish();
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: handleError,
  });

  return { ...chat, threadId };
}
