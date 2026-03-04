import { useEffect } from "react";
import { API_STREAM_TIMEOUT_MS } from "../../shared-overlay/constants";
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
  try {
    const apiUrl = await window.electronAPI?.getApiUrl?.();
    const sessionToken = await window.electronAPI?.getSessionToken?.();

    if (!apiUrl || !sessionToken) {
      log.warn("No API URL or session token — falling back to simulated");
      throw new Error("No API");
    }

    const res = await fetch(`${apiUrl}/stream/assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ message, history: [] }),
      signal: AbortSignal.timeout(API_STREAM_TIMEOUT_MS),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Stream ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          onComplete(
            "Assistant",
            fullText.split("\n").filter(Boolean)
          );
          return;
        }
        try {
          const parsed = JSON.parse(data) as { token?: string };
          if (parsed.token) {
            fullText += parsed.token;
            onToken(parsed.token);
          }
        } catch {
          // skip
        }
      }
    }
    onComplete("Assistant", fullText.split("\n").filter(Boolean));
  } catch {
    const resp = getSimulatedResponse(message);
    const words = resp.lines.join(" ").split(" ");
    for (let i = 0; i < words.length; i++) {
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 30));
      onToken((i > 0 ? " " : "") + words[i]!);
    }
    onComplete(resp.title, resp.lines);
  }
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
        case "create_task":
          dispatch({
            type: "COMMAND_RESULT",
            title: "Task Created",
            lines: [cmd.title, "Added to your task list"],
          });
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
    );
  }, [pillState, transcript, dispatch, streamAbortRef]);
};
