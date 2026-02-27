// ---------------------------------------------------------------------------
// useMeetingControls — meeting lifecycle IPC handlers
// ---------------------------------------------------------------------------

import { useCallback, type Dispatch, type MutableRefObject } from "react";
import { FLASH_MEDIUM_MS, FLASH_LONG_MS } from "../../../shared/constants.js";
import { createDesktopLogger } from "../../../shared/logger.js";
import type { PillAction, PillContext } from "./notch-pill-state";
import type { MeetingRecorderActions } from "./meeting-recorder";
import { uploadMeetingTranscript, processMeeting } from "../api";

const log = createDesktopLogger("meeting-controls");

export type MeetingHandlers = {
  handleMeetingToggle: () => void;
  handleMeetingStarted: (meetingId: string) => void;
  handleMeetingStopped: (meetingId: string) => void;
  handleSystemAudioTranscript: (speaker: number | undefined, text: string) => void;
  restoreMeetingState: () => void;
  restorePersistedMeeting: () => void;
};

export const useMeetingControls = (deps: {
  dispatch: Dispatch<PillAction>;
  pillRef: MutableRefObject<PillContext>;
  meetingRecorderRef: MutableRefObject<MeetingRecorderActions>;
  showFlash: (msg: string, durationMs: number) => void;
}): MeetingHandlers => {
  const { dispatch, pillRef, meetingRecorderRef, showFlash } = deps;

  const handleMeetingToggle = useCallback((): void => {
    const cur = pillRef.current;
    const api = window.electronAPI;
    if (!api) return;

    log.debug(`meeting-toggle: meetingActive=${cur.meetingActive}`);

    if (cur.meetingActive) {
      log.info("Calling stopMeeting...");
      api.stopMeeting?.().catch((err: unknown) => log.error("stopMeeting failed:", err));
    } else {
      void (async () => {
        const granted = await api.promptScreenRecording?.() ?? true;
        log.debug(`promptScreenRecording=${granted}`);
        if (!granted) {
          showFlash("Grant Screen Recording permission, then try again", FLASH_LONG_MS);
          return;
        }
        log.info("Calling startMeeting...");
        try {
          await api.startMeeting?.();
          log.debug("startMeeting resolved");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error(`startMeeting error: ${msg}`);
          showFlash("Meeting failed: " + msg, FLASH_LONG_MS);
        }
      })();
    }
  }, [pillRef, showFlash]);

  const handleMeetingStarted = useCallback((meetingId: string): void => {
    const api = window.electronAPI;
    log.info("meeting-started, meetingId:", meetingId);
    dispatch({ type: "MEETING_UPDATE", active: true, meetingId, startedAt: Date.now() });

    void (async () => {
      try {
        log.info("Starting meeting recorder for:", meetingId);
        const { micOnly } = await meetingRecorderRef.current.startRecording(meetingId);
        log.info("Meeting recorder started, micOnly:", micOnly);
        showFlash(micOnly ? "Recording (mic only)" : "Recording (mic + system audio)", FLASH_LONG_MS);
      } catch (err: unknown) {
        log.error("Failed to start meeting recording:", err);
        showFlash("Recording failed", FLASH_LONG_MS);
        api?.stopMeeting?.().catch(() => undefined);
      }
    })();
  }, [dispatch, meetingRecorderRef, showFlash]);

  const handleMeetingStopped = useCallback((_meetingId: string): void => {
    log.info("meeting-stopped IPC received");
    showFlash("Saving meeting...", 30_000);

    void (async () => {
      log.info("Stopping meeting recorder...");
      const result = await meetingRecorderRef.current.stopRecording();
      log.info("Recorder stopped — meetingId:", result.meetingId, "transcript:", result.transcript.length);
      dispatch({ type: "MEETING_UPDATE", active: false, meetingId: null, startedAt: null });

      if (result.meetingId && result.transcript) {
        try {
          log.info("Uploading transcript for:", result.meetingId);
          await uploadMeetingTranscript(result.meetingId, result.transcript);
          log.info("Transcript uploaded, triggering AI processing...");
          await processMeeting(result.meetingId);
          log.info("Meeting processing triggered");
          showFlash("Meeting saved", FLASH_MEDIUM_MS);
        } catch (err: unknown) {
          log.error("Failed to finalize meeting:", err);
          showFlash("Save failed", FLASH_MEDIUM_MS);
        }
      } else {
        log.info("No transcript — meetingId:", result.meetingId, "empty:", !result.transcript);
        // Clear the "Saving meeting..." flash
        showFlash("", 1);
      }
    })();
  }, [dispatch, meetingRecorderRef, showFlash]);

  const handleSystemAudioTranscript = useCallback((speaker: number | undefined, text: string): void => {
    const label = speaker !== undefined ? `Speaker ${speaker}` : "System";
    log.debug(`${label}: ${text}`);
  }, []);

  const restoreMeetingState = useCallback((): void => {
    window.electronAPI?.getMeetingState?.().then((state) => {
      log.info("Meeting state on mount:", JSON.stringify(state));
      if (state.active && state.meetingId) {
        dispatch({ type: "MEETING_UPDATE", active: true, meetingId: state.meetingId, startedAt: state.startedAt });
        void meetingRecorderRef.current.startRecording(state.meetingId).catch(() => undefined);
      }
    }).catch(() => undefined);
  }, [dispatch, meetingRecorderRef]);

  const restorePersistedMeeting = useCallback((): void => {
    window.electronAPI?.getPersistedMeeting?.().then((persisted) => {
      log.info("Persisted meeting state:", persisted ? JSON.stringify(persisted) : "none");
      if (persisted) {
        dispatch({ type: "MEETING_UPDATE", active: true, meetingId: persisted.meetingId, startedAt: persisted.startedAt });
        showFlash("Meeting resumed", FLASH_MEDIUM_MS);
      }
    }).catch(() => undefined);
  }, [dispatch, showFlash]);

  return {
    handleMeetingToggle,
    handleMeetingStarted,
    handleMeetingStopped,
    handleSystemAudioTranscript,
    restoreMeetingState,
    restorePersistedMeeting,
  };
};
