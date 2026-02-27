// ---------------------------------------------------------------------------
// NotchPill state machine — reducer-based, no external deps
// ---------------------------------------------------------------------------

import type { ActivationMode } from "../../../shared/types.js";

export type PillState = "idle" | "listening" | "thinking" | "response" | "transcribing";

/** Alias for ActivationMode — kept for backward compatibility in reducer code. */
export type InteractionMode = ActivationMode;

export type PillAction =
  | { type: "ACTIVATE"; mode: InteractionMode }
  | { type: "DEACTIVATE" }
  | { type: "LISTENING_COMPLETE"; transcript: string }
  | { type: "COMMAND_RESULT"; title: string; lines: string[] }
  | { type: "AI_STREAMING"; text: string }
  | { type: "AI_COMPLETE"; title: string; lines: string[] }
  | { type: "AI_ERROR"; message: string }
  | { type: "DISMISS" }
  | { type: "MEETING_UPDATE"; active: boolean; meetingId: string | null; startedAt: number | null }
  | { type: "TRANSCRIBING_START" }
  | { type: "TRANSCRIBING_COMPLETE"; transcript: string }
  | { type: "TRANSCRIBING_ERROR"; message: string };

export type PillContext = {
  state: PillState;
  interactionMode: InteractionMode;
  transcript: string;
  responseTitle: string;
  responseLines: string[];
  streamingText: string;
  meetingActive: boolean;
  meetingId: string | null;
  meetingStartedAt: number | null;
};

export const initialPillContext: PillContext = {
  state: "idle",
  interactionMode: "assistant",
  transcript: "",
  responseTitle: "",
  responseLines: [],
  streamingText: "",
  meetingActive: false,
  meetingId: null,
  meetingStartedAt: null,
};

export const pillReducer = (ctx: PillContext, action: PillAction): PillContext => {
  switch (action.type) {
    case "ACTIVATE":
      if (ctx.state !== "idle") return { ...ctx, ...initialPillContext, meetingActive: ctx.meetingActive, meetingId: ctx.meetingId, meetingStartedAt: ctx.meetingStartedAt };
      return {
        ...ctx,
        state: "listening",
        interactionMode: action.mode,
        transcript: "",
        responseTitle: "",
        responseLines: [],
        streamingText: "",
      };

    case "DEACTIVATE":
    case "DISMISS":
      return { ...ctx, state: "idle", transcript: "", responseTitle: "", responseLines: [], streamingText: "" };

    case "LISTENING_COMPLETE":
      // Dictation + transcribe go straight to idle (handled externally before dispatch)
      if (ctx.interactionMode === "dictation" || ctx.interactionMode === "transcribe") {
        return { ...ctx, state: "idle", transcript: action.transcript };
      }
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
      return { ...ctx, meetingActive: action.active, meetingId: action.meetingId, meetingStartedAt: action.startedAt };

    case "TRANSCRIBING_START":
      return { ...ctx, state: "transcribing" };

    case "TRANSCRIBING_COMPLETE":
      return { ...ctx, state: "idle", transcript: action.transcript };

    case "TRANSCRIBING_ERROR":
      return { ...ctx, state: "response", responseTitle: "Error", responseLines: [action.message], streamingText: "" };

    default:
      return ctx;
  }
};
