// ---------------------------------------------------------------------------
// useActivationHandler — pill activation/deactivation + hold-to-talk handlers
// ---------------------------------------------------------------------------

import { useCallback, type Dispatch, type MutableRefObject } from "react";
import type { ActivationMode } from "../../../shared/types.js";
import { FLASH_SHORT_MS } from "../../../shared/constants.js";
import { createDesktopLogger } from "../../../shared/logger.js";
import type { PillAction, PillContext, InteractionMode } from "./notch-pill-state";
import type { SpeechRecognitionState } from "./whisper";

const log = createDesktopLogger("activation");

export type ActivationHandlers = {
  handleActivate: (mode: ActivationMode) => void;
  handleDeactivate: () => void;
  handleHoldStart: () => void;
  handleHoldEnd: () => void;
};

export const useActivationHandler = (deps: {
  dispatch: Dispatch<PillAction>;
  pillRef: MutableRefObject<PillContext>;
  speechRef: MutableRefObject<SpeechRecognitionState>;
  dismissRef: MutableRefObject<() => void>;
  showFlash: (msg: string, durationMs: number) => void;
}): ActivationHandlers => {
  const { dispatch, pillRef, speechRef, dismissRef, showFlash } = deps;

  const handleActivate = useCallback((mode: ActivationMode): void => {
    const cur = pillRef.current;
    const s = speechRef.current;

    if (cur.state !== "idle") {
      // DICTATION active, press again → stop, transcribe, paste, dismiss
      if (cur.interactionMode === "dictation" && mode === "dictation") {
        dispatch({ type: "TRANSCRIBING_START" });
        s.stopListening().then((transcript) => {
          if (transcript) {
            void window.electronAPI?.injectText(transcript).then(() => {
              dispatch({ type: "TRANSCRIBING_COMPLETE", transcript });
              showFlash("Copied! \u2318V to paste", FLASH_SHORT_MS);
              setTimeout(() => dismissRef.current(), FLASH_SHORT_MS);
            });
          } else {
            dismissRef.current();
          }
        }).catch(() => dismissRef.current());
        return;
      }

      // TRANSCRIBE active, press again → stop, copy to clipboard
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
        }).catch(() => dismissRef.current());
        return;
      }

      // CONTINUOUS active, press again → stop listening, send to AI
      if (cur.interactionMode === "continuous" && mode === "continuous") {
        void s.stopListening().then((transcript) => {
          if (transcript) {
            dispatch({ type: "LISTENING_COMPLETE", transcript });
          } else {
            dismissRef.current();
          }
        });
        return;
      }

      // ASSISTANT active, press again while listening → stop early
      if (cur.interactionMode === "assistant" && mode === "assistant" && cur.state === "listening") {
        void s.stopListening().then((transcript) => {
          if (transcript) {
            dispatch({ type: "LISTENING_COMPLETE", transcript });
          } else {
            dismissRef.current();
          }
        });
        return;
      }

      // Anything else while active → dismiss
      dismissRef.current();
      return;
    }

    // Start fresh activation
    dispatch({ type: "ACTIVATE", mode: mode as InteractionMode });
    s.startListening();
  }, [dispatch, pillRef, speechRef, dismissRef, showFlash]);

  const handleDeactivate = useCallback((): void => {
    if (speechRef.current.isListening) {
      void speechRef.current.stopListening();
    }
    dispatch({ type: "DEACTIVATE" });
  }, [dispatch, speechRef]);

  const handleHoldStart = useCallback((): void => {
    const cur = pillRef.current;
    if (cur.state !== "idle") return;
    dispatch({ type: "ACTIVATE", mode: "dictation" });
    speechRef.current.startListening();
  }, [dispatch, pillRef, speechRef]);

  const handleHoldEnd = useCallback((): void => {
    const cur = pillRef.current;
    log.debug(`onHoldEnd: state=${cur.state}, mode=${cur.interactionMode}`);
    if (cur.state !== "listening" || cur.interactionMode !== "dictation") return;

    dispatch({ type: "TRANSCRIBING_START" });
    speechRef.current.stopListening().then((transcript) => {
      log.debug(`onHoldEnd transcription: "${transcript.slice(0, 40)}${transcript.length > 40 ? "..." : ""}" (${transcript.length} chars)`);
      if (transcript) {
        dispatch({ type: "TRANSCRIBING_COMPLETE", transcript });
        log.debug(`Calling injectText (${transcript.length} chars)`);
        window.electronAPI?.injectText(transcript).then(() => {
          log.debug("injectText resolved — showing flash");
          showFlash("Copied! \u2318V to paste", FLASH_SHORT_MS);
        }).catch((err: unknown) => {
          log.error("injectText failed:", err);
        });
      } else {
        log.debug("onHoldEnd: empty transcript — dismissing");
        dismissRef.current();
      }
    }).catch((err: unknown) => {
      log.error("onHoldEnd: stopListening threw:", err);
      dismissRef.current();
    });
  }, [dispatch, pillRef, speechRef, dismissRef, showFlash]);

  return { handleActivate, handleDeactivate, handleHoldStart, handleHoldEnd };
};
