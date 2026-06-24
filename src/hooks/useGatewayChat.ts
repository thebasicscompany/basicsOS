import { useChat, type Message } from "@ai-sdk/react";
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getRuntimeApiUrl } from "@/lib/runtime-config";
const API_URL = getRuntimeApiUrl();

const TOOL_TO_QUERY_KEYS: Record<string, string[][]> = {
  search_contacts: [["records", "contacts"]],
  get_contact: [["records", "contacts"]],
  create_contact: [["records", "contacts"]],
  update_contact: [["records", "contacts"]],
  delete_contact: [["records", "contacts"]],
  search_deals: [["records", "deals"]],
  get_deal: [["records", "deals"]],
  create_deal: [["records", "deals"]],
  update_deal: [["records", "deals"]],
  delete_deal: [["records", "deals"]],
  search_companies: [["records", "companies"]],
  get_company: [["records", "companies"]],
  create_company: [["records", "companies"]],
  update_company: [["records", "companies"]],
  delete_company: [["records", "companies"]],
  search_tasks: [["records", "tasks"]],
  list_tasks: [["records", "tasks"]],
  create_task: [["records", "tasks"]],
  complete_task: [["records", "tasks"]],
  list_notes: [["records", "contact_notes"]],
  create_note: [["records", "contact_notes"]],
  add_note: [["records", "contact_notes"], ["records", "deal_notes"]],
  create_custom_field: [["columns"], ["object-config"], ["custom-fields"]],
  delete_custom_field: [["columns"], ["object-config"], ["custom-fields"]],
};

interface UseGatewayChatOptions {
  initialThreadId?: string;
  initialMessages?: Message[];
  /** Scope the chat to one object/record (a per-record chat tab). The agent is
   *  restricted to that object's tools and told which record it's on. */
  scope?: { object: string; recordId?: number };
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
    // The agent can create/edit records, columns, AND objects via broker tools
    // whose names aren't in TOOL_TO_QUERY_KEYS (e.g. mcp_broker_object_*_create,
    // mcp_broker_custom_field_create). Always refresh the core CRM queries so a
    // chat-created column/record/object shows up live in the grid + sidebar.
    queryClient.invalidateQueries({ queryKey: ["records"] });
    queryClient.invalidateQueries({ queryKey: ["columns"] });
    queryClient.invalidateQueries({ queryKey: ["object-config"] });
    for (const name of names) {
      const keys = TOOL_TO_QUERY_KEYS[name];
      if (keys) {
        for (const queryKey of keys) {
          queryClient.invalidateQueries({ queryKey });
        }
      }
    }
    pendingToolsRef.current = new Set();
  }, [queryClient]);

  const chat = useChat({
    // Hermes-backed agent (replaces the in-process gateway-chat brain). Same wire
    // format + thread persistence, so the rest of this hook is unchanged.
    api: `${API_URL}/api/agent-chat`,
    body: { threadId, channel: "chat", scope: opts?.scope },
    initialMessages: opts?.initialMessages,
    fetch: fetchWithErrorHandling,
    maxSteps: 5,
    onResponse: (response) => {
      const nextThreadId = response.headers.get("X-Thread-Id");
      if (nextThreadId) {
        setThreadId(nextThreadId);
        if (!opts?.initialThreadId) {
          queryClient.invalidateQueries({ queryKey: ["threads"] });
        }
      }
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
