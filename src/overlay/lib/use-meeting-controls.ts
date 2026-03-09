import { useCallback } from "react";
import { FLASH_MEDIUM_MS, FLASH_LONG_MS } from "@/shared-overlay/constants";
import { createOverlayLogger } from "./overlay-logger";
import type { PillAction, PillContext } from "./notch-pill-state";
import type { MeetingRecorderActions } from "@/overlay/meeting-recorder";
import { uploadMeetingTranscript, processMeeting } from "@/overlay/api";

const log = createOverlayLogger("meeting-controls");

export type MeetingHandlers = {
  handleMeetingToggle: () => void;
  handleMeetingStarted: (meetingId: string) => void;
  handleMeetingStopped: (meetingId: string) => void;
  handleSystemAudioTranscript: (speaker: number | undefined, text: string) => void;
  restoreMeetingState: () => void;
  restorePersistedMeeting: () => void;
};

export const useMeetingControls = (deps: {
  dispatch: (a: PillAction) => void;
  pillRef: { current: PillContext };
  meetingRecorderRef: { current: MeetingRecorderActions };
  showFlash: (msg: string, durationMs: number) => void;
}): MeetingHandlers => {
  const { dispatch, pillRef, meetingRecorderRef, showFlash } = deps;

  const handleMeetingToggle = useCallback(() => {
    const cur = pillRef.current;
    const api = window.electronAPI;
    log.info("[TOGGLE] meetingActive=", cur.meetingActive, "meetingId=", cur.meetingId, "api=", !!api);
    if (!api) { log.error("[TOGGLE] No electronAPI!"); return; }

    if (cur.meetingActive) {
      log.info("[TOGGLE] Stopping meeting...");
      api.stopMeeting?.().catch((err) => log.error("stopMeeting failed:", err));
    } else {
      log.info("[TOGGLE] Starting meeting...");
      void (async () => {
        try {
          await api.startMeeting?.();
          log.info("[TOGGLE] startMeeting IPC resolved");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error("[TOGGLE] startMeeting failed:", msg);
          showFlash("Meeting failed: " + msg, FLASH_LONG_MS);
        }
      })();
    }
  }, [pillRef, showFlash]);

  const handleMeetingStarted = useCallback(
    (meetingId: string) => {
      log.info("[STARTED] meeting-started IPC received, meetingId=", meetingId);
      dispatch({
        type: "MEETING_UPDATE",
        active: true,
        meetingId,
        startedAt: Date.now(),
      });

      void (async () => {
        try {
          log.info("[STARTED] Calling meetingRecorder.startRecording...");
          const result = await meetingRecorderRef.current.startRecording(meetingId);
          const mode = result.micOnly ? "mic only" : "mic + system audio";
          log.info("[STARTED] Recording started successfully, mode=", mode);
          showFlash(`Recording (${mode})`, FLASH_LONG_MS);
        } catch (err) {
          log.error("[STARTED] Failed to start recording:", err instanceof Error ? err.message : err);
          showFlash("Recording failed", FLASH_LONG_MS);
          window.electronAPI?.stopMeeting?.().catch(() => undefined);
        }
      })();
    },
    [dispatch, meetingRecorderRef, showFlash]
  );

  const handleMeetingStopped = useCallback(
    (_meetingId: string) => {
      log.info("[STOPPED] meeting-stopped IPC received, meetingId=", _meetingId);
      log.info("[STOPPED] Current pill state: meetingActive=", pillRef.current.meetingActive);
      showFlash("Saving meeting...", 5000);

      void (async () => {
        log.info("[STOPPED] Calling meetingRecorder.stopRecording...");
        const result = await meetingRecorderRef.current.stopRecording();
        log.info("[STOPPED] stopRecording returned, meetingId=", result.meetingId, "transcriptLen=", result.transcript?.length ?? 0);
        dispatch({
          type: "MEETING_UPDATE",
          active: false,
          meetingId: null,
          startedAt: null,
        });

        log.info("[STOPPED] transcript preview (first 200 chars):", result.transcript?.slice(0, 200));
        log.info("[STOPPED] transcript preview (last 200 chars):", result.transcript?.slice(-200));
        log.info("[STOPPED] segments count:", result.segments?.length ?? 0);

        if (result.meetingId && (result.transcript || result.segments?.length)) {
          try {
            log.info("[STOPPED] Uploading transcript for meetingId=", result.meetingId, "textLen=", result.transcript?.length);
            await uploadMeetingTranscript(result.meetingId, result.transcript);
            log.info("[STOPPED] Upload complete, now processing...");
            showFlash("Processing meeting...", FLASH_LONG_MS);
            await processMeeting(result.meetingId);
            log.info("[STOPPED] Processing complete");
            showFlash("Meeting saved", FLASH_MEDIUM_MS);
          } catch (err) {
            log.error("Failed to upload/process meeting:", err);
            showFlash("Meeting saved (summary failed)", FLASH_MEDIUM_MS);
          }
        } else {
          log.warn("[STOPPED] No transcript to upload! meetingId=", result.meetingId, "transcriptLen=", result.transcript?.length, "segmentsLen=", result.segments?.length);
          showFlash("Meeting ended (no transcript)", FLASH_MEDIUM_MS);
        }
      })();
    },
    [dispatch, meetingRecorderRef, showFlash, pillRef]
  );

  const handleSystemAudioTranscript = useCallback(
    (speaker: number | undefined, text: string) => {
      log.debug(speaker !== undefined ? `Speaker ${speaker}` : "System", text);
    },
    []
  );

  const restoreMeetingState = useCallback(() => {
    window.electronAPI?.getMeetingState?.().then((state) => {
      if (state?.active && state.meetingId) {
        dispatch({
          type: "MEETING_UPDATE",
          active: true,
          meetingId: state.meetingId,
          startedAt: state.startedAt ?? null,
        });
        void meetingRecorderRef.current
          .startRecording(state.meetingId)
          .catch(() => undefined);
      }
    });
  }, [dispatch, meetingRecorderRef]);

  const restorePersistedMeeting = useCallback(() => {
    window.electronAPI?.getPersistedMeeting?.().then((persisted) => {
      if (persisted) {
        dispatch({
          type: "MEETING_UPDATE",
          active: true,
          meetingId: persisted.meetingId,
          startedAt: persisted.startedAt,
        });
        showFlash("Meeting resumed", FLASH_MEDIUM_MS);
      }
    });
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
