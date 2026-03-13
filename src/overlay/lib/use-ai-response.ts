import { useEffect, useRef } from "react";
import { API_STREAM_TIMEOUT_MS } from "@/shared-overlay/constants";
import { streamAssistant } from "@/overlay/api";
import { createOverlayLogger } from "./overlay-logger";
import { detectCommand } from "./voice-commands";
import type { PillAction, PillState, ConversationEntry } from "./notch-pill-state";

const log = createOverlayLogger("ai-response");

const PILL_THREAD_KEY = "basicsos-pill-thread-id";
const PILL_LAST_MESSAGE_KEY = "basicsos-pill-last-message-ms";
const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

function getStoredThreadId(): string | undefined {
  try {
    const s = localStorage.getItem(PILL_THREAD_KEY);
    return s?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function isFollowUpQuestion(text: string): boolean {
  if (text.length > 300) return false;
  const trimmed = text.trim();
  if (trimmed.endsWith("?")) return true;
  const lower = trimmed.toLowerCase();
  const patterns = [
    "which ", "could you ", "can you clarify", "what is the",
    "do you want", "would you like", "please provide", "i need",
    "can you specify", "what should", "who should", "where should",
  ];
  return patterns.some(p => lower.includes(p));
}

const TOOL_TITLE_MAP: Record<string, string> = {
  search_contacts: "Found contacts",
  get_contact: "Contact details",
  create_contact: "Created contact",
  update_contact: "Updated contact",
  search_deals: "Found deals",
  get_deal: "Deal details",
  create_deal: "Created deal",
  update_deal: "Updated deal",
  search_companies: "Found companies",
  get_company: "Company details",
  create_company: "Created company",
  update_company: "Updated company",
  search_tasks: "Found tasks",
  list_tasks: "Tasks",
  create_task: "Created task",
  complete_task: "Completed task",
  list_notes: "Notes",
  create_note: "Added note",
  add_note: "Added note",
};

function deriveResponseTitle(text: string, toolsUsed: string[]): string {
  if (toolsUsed.length > 0) {
    // Use the last write tool, or the last tool overall
    const writeTool = [...toolsUsed].reverse().find(
      t => t.startsWith("create_") || t.startsWith("update_") || t.startsWith("delete_") || t === "complete_task" || t === "add_note" || t === "run_automation",
    );
    const key = writeTool ?? toolsUsed[toolsUsed.length - 1]!;
    return TOOL_TITLE_MAP[key] ?? "Assistant";
  }
  if (isFollowUpQuestion(text)) return "Question";
  return "Assistant";
}

const SIMULATED_RESPONSES = [
  {
    title: "Assistant",
    lines: ["I'd be happy to help with that.", "Let me look into it for you."],
  },
  {
    title: "Answer",
    lines: [
      "The quarterly review is scheduled for Friday at 2pm.",
      "Sarah and Alex are presenting.",
    ],
  },
  {
    title: "Summary",
    lines: ["3 relevant documents and 2 recent tasks match your query."],
  },
];

let simIdx = 0;

const getSimulatedResponse = (transcript: string) => {
  const lower = transcript.toLowerCase();
  if (lower.includes("meeting") || lower.includes("schedule")) {
    return {
      title: "Meetings",
      lines: [
        "Your next meeting is the Weekly Sync at 2pm.",
        "Alex, Sarah, and 3 others.",
      ],
    };
  }
  if (lower.includes("task") || lower.includes("todo")) {
    return {
      title: "Tasks",
      lines: [
        "5 tasks in progress.",
        "2 due today: Design review and API docs.",
      ],
    };
  }
  const resp = SIMULATED_RESPONSES[simIdx % SIMULATED_RESPONSES.length]!;
  simIdx++;
  return resp;
};

const streamAssistantAPI = async (
  message: string,
  history: ConversationEntry[],
  threadId: string | undefined,
  onThreadId: (threadId: string) => void,
  onToken: (token: string) => void,
  onComplete: (title: string, lines: string[], toolsUsed: string[]) => void
): Promise<void> => {
  let fullText = "";
  let toolsUsed: string[] = [];
  for await (const token of streamAssistant(message, history, {
    timeoutMs: API_STREAM_TIMEOUT_MS,
    threadId,
    onThreadId,
    onToolsUsed: (tools) => { toolsUsed = tools; },
  })) {
    fullText += token;
    onToken(token);
  }
  const title = deriveResponseTitle(fullText, toolsUsed);
  onComplete(title, fullText.split("\n").filter(Boolean), toolsUsed);
};

export const useAIResponse = (
  pillState: PillState,
  transcript: string,
  conversationHistory: ConversationEntry[],
  pendingVoiceContext: string,
  dispatch: (a: PillAction) => void,
  streamAbortRef: { current: boolean }
): void => {
  // Keep a ref to history so the effect can read the latest value without
  // needing it as a dependency (history changes don't need to re-trigger calls).
  const historyRef = useRef(conversationHistory);
  historyRef.current = conversationHistory;
  const threadIdRef = useRef<string | undefined>(getStoredThreadId());
  const lastMessageAtRef = useRef<number | null>(null);
  const lastMessageLoadedRef = useRef(false);

  useEffect(() => {
    const stored = threadIdRef.current;
    if (stored) {
      dispatch({ type: "SET_THREAD_ID", threadId: stored });
    }
  }, [dispatch]);

  useEffect(() => {
    if (pillState !== "thinking" || !transcript) return;

    // cancelled flag prevents a stale or duplicate call (e.g. from an
    // interrupted effect) from dispatching after it has been superseded.
    let cancelled = false;

    if (!lastMessageLoadedRef.current) {
      lastMessageLoadedRef.current = true;
      try {
        const s = localStorage.getItem(PILL_LAST_MESSAGE_KEY);
        lastMessageAtRef.current = s ? parseInt(s, 10) : null;
      } catch {
        lastMessageAtRef.current = null;
      }
    }

    const now = Date.now();
    if (threadIdRef.current) {
      const lastMs = lastMessageAtRef.current;
      if (lastMs != null && now - lastMs > IDLE_THRESHOLD_MS) {
        threadIdRef.current = undefined;
        dispatch({ type: "SET_THREAD_ID", threadId: null });
        try {
          localStorage.removeItem(PILL_THREAD_KEY);
          localStorage.removeItem(PILL_LAST_MESSAGE_KEY);
        } catch {
          /* ignore */
        }
      }
    }

    try {
      localStorage.setItem(PILL_LAST_MESSAGE_KEY, String(now));
    } catch {
      /* ignore */
    }
    lastMessageAtRef.current = now;

    const cmd = detectCommand(transcript);
    if (cmd) {
      switch (cmd.type) {
        case "navigate":
          dispatch({
            type: "COMMAND_RESULT",
            title: `Opening ${cmd.module}`,
            lines: ["Navigating..."],
          });
          window.electronAPI?.navigateMain?.(cmd.url);
          return;
        case "search":
          dispatch({
            type: "COMMAND_RESULT",
            title: "Searching",
            lines: [`"${cmd.query}"`, "Opening results..."],
          });
          window.electronAPI?.navigateMain?.(
            `/chat?q=${encodeURIComponent(cmd.query)}`
          );
          return;
      }
    }

    // Pass prior history (excluding the current user message which is already
    // included as `message` by the server) so the AI has multi-turn context.
    const priorHistory = historyRef.current.slice(0, -1);

    const message =
      pendingVoiceContext.trim().length > 0
        ? `${pendingVoiceContext.trim()}\n\nUser said: ${transcript}`
        : transcript;

    streamAbortRef.current = false;
    void streamAssistantAPI(
      message,
      priorHistory,
      threadIdRef.current,
      (nextThreadId) => {
        threadIdRef.current = nextThreadId;
        dispatch({ type: "SET_THREAD_ID", threadId: nextThreadId });
        try {
          localStorage.setItem(PILL_THREAD_KEY, nextThreadId);
        } catch {
          /* ignore */
        }
      },
      (token) => {
        if (cancelled || streamAbortRef.current) return;
        dispatch({ type: "AI_STREAMING", text: token });
      },
      (title, lines, toolsUsed) => {
        if (cancelled || streamAbortRef.current) return;
        if (pendingVoiceContext) dispatch({ type: "CLEAR_PENDING_VOICE_CONTEXT" });
        dispatch({ type: "AI_COMPLETE", title, lines, toolsUsed });
        const fullText = lines.join("\n");
        if (toolsUsed.length === 0 && isFollowUpQuestion(fullText)) {
          dispatch({ type: "SET_FOLLOW_UP", needsFollowUp: true });
        }
      }
    ).catch((err) => {
      if (cancelled || streamAbortRef.current) return;

      if (import.meta.env.DEV) {
        log.warn("Assistant stream failed, using simulated response:", err);
        const resp = getSimulatedResponse(transcript);
        dispatch({
          type: "AI_COMPLETE",
          title: resp.title,
          lines: resp.lines,
          toolsUsed: [],
        });
        return;
      }

      dispatch({
        type: "AI_ERROR",
        message: "Assistant is unavailable. Check API/backend auth.",
      });
    });

    return () => {
      cancelled = true;
    };
  // conversationHistory intentionally omitted: history updates (e.g. appending
  // the assistant reply) must not re-trigger a new API call. We read it via
  // historyRef instead.
  }, [pillState, transcript, pendingVoiceContext, dispatch, streamAbortRef]);
};
