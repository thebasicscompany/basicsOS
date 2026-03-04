import { useCallback } from "react";
import { FLASH_MEDIUM_MS, FLASH_LONG_MS } from "../../shared-overlay/constants";
import { createOverlayLogger } from "./overlay-logger";
import type { PillAction, PillContext } from "./notch-pill-state";
import type { MeetingRecorderActions } from "../meeting-recorder-stub";

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
    if (!api) return;

    if (cur.meetingActive) {
      api.stopMeeting?.().catch((err) => log.error("stopMeeting failed:", err));
    } else {
      void (async () => {
        try {
          await api.startMeeting?.();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          showFlash("Meeting failed: " + msg, FLASH_LONG_MS);
        }
      })();
    }
  }, [pillRef, showFlash]);

  const handleMeetingStarted = useCallback(
    (meetingId: string) => {
      log.info("meeting-started:", meetingId);
      dispatch({
        type: "MEETING_UPDATE",
        active: true,
        meetingId,
        startedAt: Date.now(),
      });

      void (async () => {
        try {
          await meetingRecorderRef.current.startRecording(meetingId);
          showFlash("Recording (stub — no backend)", FLASH_LONG_MS);
        } catch (err) {
          log.error("Failed to start meeting recording:", err);
          showFlash("Recording failed", FLASH_LONG_MS);
          window.electronAPI?.stopMeeting?.().catch(() => undefined);
        }
      })();
    },
    [dispatch, meetingRecorderRef, showFlash]
  );

  const handleMeetingStopped = useCallback(
    (_meetingId: string) => {
      log.info("meeting-stopped");
      showFlash("Saving meeting...", 5000);

      void (async () => {
        const result = await meetingRecorderRef.current.stopRecording();
        dispatch({
          type: "MEETING_UPDATE",
          active: false,
          meetingId: null,
          startedAt: null,
        });

        if (result.meetingId && result.transcript) {
          showFlash("Meeting saved", FLASH_MEDIUM_MS);
        } else {
          showFlash("Meeting ended (stub — no transcript)", FLASH_MEDIUM_MS);
        }
      })();
    },
    [dispatch, meetingRecorderRef, showFlash]
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
