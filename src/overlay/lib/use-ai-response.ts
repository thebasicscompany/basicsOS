import { useEffect, useRef } from "react";
import { API_STREAM_TIMEOUT_MS } from "@/shared-overlay/constants";
import { streamAssistant } from "@/overlay/api";
import { createOverlayLogger } from "./overlay-logger";
import { detectCommand } from "./voice-commands";
import type { PillAction, PillState, ConversationEntry } from "./notch-pill-state";

const log = createOverlayLogger("ai-response");

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
  onComplete: (title: string, lines: string[]) => void
): Promise<void> => {
  let fullText = "";
  for await (const token of streamAssistant(message, history, {
    timeoutMs: API_STREAM_TIMEOUT_MS,
    threadId,
    onThreadId,
  })) {
    fullText += token;
    onToken(token);
  }
  onComplete("Assistant", fullText.split("\n").filter(Boolean));
};

export const useAIResponse = (
  pillState: PillState,
  transcript: string,
  conversationHistory: ConversationEntry[],
  dispatch: (a: PillAction) => void,
  streamAbortRef: { current: boolean }
): void => {
  // Keep a ref to history so the effect can read the latest value without
  // needing it as a dependency (history changes don't need to re-trigger calls).
  const historyRef = useRef(conversationHistory);
  historyRef.current = conversationHistory;
  const threadIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (pillState !== "thinking" || !transcript) return;

    // cancelled flag prevents a stale or duplicate call (e.g. from an
    // interrupted effect) from dispatching after it has been superseded.
    let cancelled = false;

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

    streamAbortRef.current = false;
    void streamAssistantAPI(
      transcript,
      priorHistory,
      threadIdRef.current,
      (nextThreadId) => {
        threadIdRef.current = nextThreadId;
      },
      (token) => {
        if (cancelled || streamAbortRef.current) return;
        dispatch({ type: "AI_STREAMING", text: token });
      },
      (title, lines) => {
        if (cancelled || streamAbortRef.current) return;
        dispatch({ type: "AI_COMPLETE", title, lines });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pillState, transcript, dispatch, streamAbortRef]);
};
