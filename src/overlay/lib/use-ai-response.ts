import { useEffect } from "react";
import { API_STREAM_TIMEOUT_MS } from "../../shared-overlay/constants";
import { streamAssistant } from "../api";
import { createOverlayLogger } from "./overlay-logger";
import { detectCommand } from "./voice-commands";
import type { PillAction, PillState } from "./notch-pill-state";

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
  onToken: (token: string) => void,
  onComplete: (title: string, lines: string[]) => void
): Promise<void> => {
  let fullText = "";
  for await (const token of streamAssistant(message, [], {
    timeoutMs: API_STREAM_TIMEOUT_MS,
  })) {
    fullText += token;
    onToken(token);
  }
  onComplete("Assistant", fullText.split("\n").filter(Boolean));
};

export const useAIResponse = (
  pillState: PillState,
  transcript: string,
  dispatch: (a: PillAction) => void,
  streamAbortRef: { current: boolean }
): void => {
  useEffect(() => {
    if (pillState !== "thinking" || !transcript) return;

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

    streamAbortRef.current = false;
    void streamAssistantAPI(
      transcript,
      (token) => {
        if (!streamAbortRef.current)
          dispatch({ type: "AI_STREAMING", text: token });
      },
      (title, lines) => {
        if (!streamAbortRef.current)
          dispatch({ type: "AI_COMPLETE", title, lines });
      }
    ).catch((err) => {
      if (streamAbortRef.current) return;

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
  }, [pillState, transcript, dispatch, streamAbortRef]);
};
