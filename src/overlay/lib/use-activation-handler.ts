import { useCallback } from "react";
import type { ActivationMode } from "@/shared-overlay/types";
import { FLASH_SHORT_MS } from "@/shared-overlay/constants";
import type {
  PillAction,
  PillContext,
  InteractionMode,
} from "./notch-pill-state";
import type { SpeechRecognitionState } from "./whisper";

export type ActivationHandlers = {
  handleActivate: (mode: ActivationMode) => void;
  handleDeactivate: () => void;
  handleHoldStart: () => void;
  handleHoldEnd: () => void;
};

export const useActivationHandler = (deps: {
  dispatch: (a: PillAction) => void;
  pillRef: { current: PillContext };
  speechRef: { current: SpeechRecognitionState | null };
  dismissRef: { current: () => void };
  showFlash: (msg: string, durationMs: number) => void;
}): ActivationHandlers => {
  const { dispatch, pillRef, speechRef, dismissRef, showFlash } = deps;

  const insertDictationText = useCallback(
    async (transcript: string) => {
      const result = await window.electronAPI?.insertDictationText?.(transcript);
      showFlash(result?.handled ? "Inserted" : "Copied! Paste manually", FLASH_SHORT_MS);
      return result;
    },
    [showFlash],
  );

  const handleActivate = useCallback(
    (mode: ActivationMode) => {
      const s = speechRef.current;
      if (!s) return;
      const cur = pillRef.current;

      if (cur.state === "notification" && mode === "assistant") {
        dispatch({
          type: "ACTIVATE_FROM_NOTIFICATION",
          mode: "assistant",
          context: cur.notificationContext,
        });
        s.startListening();
        return;
      }

      if (cur.state !== "idle") {
        if (cur.interactionMode === "dictation" && mode === "dictation") {
          dispatch({ type: "TRANSCRIBING_START" });
          s.stopListening().then((transcript) => {
            if (transcript) {
              void insertDictationText(transcript).then(() => {
                dispatch({ type: "TRANSCRIBING_COMPLETE", transcript });
                setTimeout(() => dismissRef.current(), FLASH_SHORT_MS);
              });
            } else {
              dismissRef.current();
            }
          });
          return;
        }

        if (cur.interactionMode === "transcribe" && mode === "transcribe") {
          dispatch({ type: "TRANSCRIBING_START" });
          s.stopListening().then((transcript) => {
            if (transcript) {
              void navigator.clipboard.writeText(transcript);
              dispatch({ type: "TRANSCRIBING_COMPLETE", transcript });
              showFlash("Copied!", FLASH_SHORT_MS);
            } else {
              dismissRef.current();
            }
          });
          return;
        }

        if (cur.interactionMode === "continuous" && mode === "continuous") {
          dispatch({ type: "TRANSCRIBING_START" });
          s.stopListening()
            .then((transcript) => {
              if (transcript) dispatch({ type: "LISTENING_COMPLETE", transcript });
              else dismissRef.current();
            })
            .catch(() => dismissRef.current());
          return;
        }

        if (
          cur.interactionMode === "assistant" &&
          mode === "assistant" &&
          cur.state === "listening"
        ) {
          dispatch({ type: "TRANSCRIBING_START" });
          s.stopListening()
            .then((transcript) => {
              if (transcript)
                dispatch({ type: "LISTENING_COMPLETE", transcript });
              else dismissRef.current();
            })
            .catch(() => dismissRef.current());
          return;
        }

        dismissRef.current();
        return;
      }

      dispatch({ type: "ACTIVATE", mode: mode as InteractionMode });
      s.startListening();
    },
    [dispatch, pillRef, speechRef, dismissRef, showFlash, insertDictationText]
  );

  const handleDeactivate = useCallback(() => {
    const s = speechRef.current;
    if (s?.isListening) {
      void s.stopListening();
    }
    dispatch({ type: "DEACTIVATE" });
  }, [dispatch, speechRef]);

  const handleHoldStart = useCallback(() => {
    if (pillRef.current.state !== "idle") return;
    const s = speechRef.current;
    if (!s) return;
    dispatch({ type: "ACTIVATE", mode: "dictation" });
    s.startListening();
  }, [dispatch, pillRef, speechRef]);

  const handleHoldEnd = useCallback(() => {
    const cur = pillRef.current;
    const s = speechRef.current;
    if (cur.state !== "listening" || cur.interactionMode !== "dictation" || !s)
      return;

    dispatch({ type: "TRANSCRIBING_START" });
    s.stopListening().then((transcript) => {
      if (transcript) {
        dispatch({ type: "TRANSCRIBING_COMPLETE", transcript });
        void insertDictationText(transcript).catch(() => dismissRef.current());
      } else {
        dismissRef.current();
      }
    });
  }, [dispatch, pillRef, speechRef, dismissRef, insertDictationText]);

  return {
    handleActivate,
    handleDeactivate,
    handleHoldStart,
    handleHoldEnd,
  };
};
