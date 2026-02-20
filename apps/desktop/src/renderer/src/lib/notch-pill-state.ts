// ---------------------------------------------------------------------------
// NotchPill state machine — reducer-based, no external deps
// ---------------------------------------------------------------------------

export type PillState = "idle" | "listening" | "thinking" | "response";

export type PillAction =
  | { type: "ACTIVATE" }
  | { type: "DEACTIVATE" }
  | { type: "LISTENING_COMPLETE"; transcript: string }
  | { type: "COMMAND_RESULT"; title: string; lines: string[] }
  | { type: "AI_STREAMING"; text: string }
  | { type: "AI_COMPLETE"; title: string; lines: string[] }
  | { type: "AI_ERROR"; message: string }
  | { type: "DISMISS" }
  | { type: "MEETING_UPDATE"; active: boolean; meetingId: string | null };

export type PillContext = {
  state: PillState;
  transcript: string;
  responseTitle: string;
  responseLines: string[];
  streamingText: string;
  meetingActive: boolean;
  meetingId: string | null;
};

export const initialPillContext: PillContext = {
  state: "idle",
  transcript: "",
  responseTitle: "",
  responseLines: [],
  streamingText: "",
  meetingActive: false,
  meetingId: null,
};

export const pillReducer = (ctx: PillContext, action: PillAction): PillContext => {
  switch (action.type) {
    case "ACTIVATE":
      if (ctx.state !== "idle") return { ...ctx, ...initialPillContext, meetingActive: ctx.meetingActive, meetingId: ctx.meetingId };
      return { ...ctx, state: "listening", transcript: "", responseTitle: "", responseLines: [], streamingText: "" };

    case "DEACTIVATE":
    case "DISMISS":
      return { ...ctx, state: "idle", transcript: "", responseTitle: "", responseLines: [], streamingText: "" };

    case "LISTENING_COMPLETE":
      return { ...ctx, state: "thinking", transcript: action.transcript };

    case "COMMAND_RESULT":
      return { ...ctx, state: "response", responseTitle: action.title, responseLines: action.lines, streamingText: "" };

    case "AI_STREAMING":
      return { ...ctx, state: "thinking", streamingText: ctx.streamingText + action.text };

    case "AI_COMPLETE":
      return { ...ctx, state: "response", responseTitle: action.title, responseLines: action.lines, streamingText: "" };

    case "AI_ERROR":
      return { ...ctx, state: "response", responseTitle: "Error", responseLines: [action.message], streamingText: "" };

    case "MEETING_UPDATE":
      return { ...ctx, meetingActive: action.active, meetingId: action.meetingId };

    default:
      return ctx;
  }
};
