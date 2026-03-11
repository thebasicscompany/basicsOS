import { useCallback, useRef } from "react";
import { FLASH_SHORT_MS, FLASH_MEDIUM_MS, FLASH_LONG_MS } from "@/shared-overlay/constants";
import { createOverlayLogger } from "./overlay-logger";
import type { PillAction, PillContext } from "./notch-pill-state";
import type { MeetingRecorderActions } from "@/overlay/meeting-recorder";
import {
  uploadMeetingTranscript,
  processMeeting,
  saveMeetingNotes,
} from "@/overlay/api";

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
  getNotesRef?: () => string;
}): MeetingHandlers => {
  const { dispatch, pillRef, meetingRecorderRef, showFlash, getNotesRef } = deps;

  /** Tracks the in-progress startRecording promise so stop can await it */
  const startPromiseRef = useRef<Promise<unknown>>(Promise.resolve());

  const handleMeetingToggle = useCallback(() => {
    const cur = pillRef.current;
    const api = window.electronAPI;
    const t = Date.now();
    log.info(`[MEETING:CTRL:HN] handleMeetingToggle entry meetingActive=${cur.meetingActive} meetingId=${cur.meetingId} state=${cur.state} api=${!!api} t=${t}`);
    if (!api) { log.error(`[MEETING:CTRL:HN] handleMeetingToggle no electronAPI t=${t}`); return; }

    if (cur.meetingActive) {
      log.info(`[MEETING:CTRL:HN] stopMeeting before call meetingId=${cur.meetingId} t=${Date.now()}`);
      api.stopMeeting?.()
        .then(() => log.info(`[MEETING:CTRL:HN] stopMeeting success t=${Date.now()}`))
        .catch((err) => log.error(`[MEETING:CTRL:HN] stopMeeting failed err=${err instanceof Error ? err.message : err} t=${Date.now()}`));
    } else {
      log.info(`[MEETING:CTRL:HN] startMeeting before call t=${Date.now()}`);
      void (async () => {
        try {
          await api.startMeeting?.();
          log.info(`[MEETING:CTRL:HN] startMeeting success t=${Date.now()}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error(`[MEETING:CTRL:HN] startMeeting failed err=${msg} t=${Date.now()}`);
          showFlash("Failed to start", FLASH_MEDIUM_MS);
        }
      })();
    }
  }, [pillRef, showFlash]);

  const handleMeetingStarted = useCallback(
    (meetingId: string) => {
      const t = Date.now();
      log.info(`[MEETING:CTRL:HN] handleMeetingStarted entry meetingId=${meetingId} t=${t}`);
      // Show "Recording" immediately, before mic setup
      showFlash("Recording", FLASH_MEDIUM_MS);
      dispatch({
        type: "MEETING_UPDATE",
        active: true,
        meetingId,
        startedAt: t,
      });

      const startPromise = (async () => {
        try {
          log.info(`[MEETING:CTRL:HN] startRecording before call meetingId=${meetingId} t=${Date.now()}`);
          const result = await meetingRecorderRef.current.startRecording(meetingId);
          const mode = result.micOnly ? "mic only" : "mic + system audio";
          log.info(`[MEETING:CTRL:HN] startRecording success mode=${mode} micOnly=${result.micOnly} t=${Date.now()}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error(`[MEETING:CTRL:HN] startRecording failed err=${msg} t=${Date.now()}`);
          showFlash("Mic error", FLASH_MEDIUM_MS);
          window.electronAPI?.stopMeeting?.().catch(() => undefined);
        }
      })();
      startPromiseRef.current = startPromise;
    },
    [dispatch, meetingRecorderRef, showFlash]
  );

  const handleMeetingStopped = useCallback(
    (_meetingId: string) => {
      const t = Date.now();
      log.info(`[MEETING:CTRL:HN] handleMeetingStopped entry meetingId=${_meetingId} pillMeetingActive=${pillRef.current.meetingActive} t=${t}`);

      // Immediately clear the meeting indicator so the pill stops showing "recording"
      dispatch({
        type: "MEETING_UPDATE",
        active: false,
        meetingId: null,
        startedAt: null,
      });
      // Single persistent message until fully done
      showFlash("Saving...", 15_000);

      void (async () => {
        // Wait for startRecording to finish (or be aborted) before stopping
        await startPromiseRef.current.catch(() => undefined);
        log.info(`[MEETING:CTRL:HN] stopRecording before call t=${Date.now()}`);
        const result = await meetingRecorderRef.current.stopRecording();
        const transcriptLen = result.transcript?.length ?? 0;
        const segmentCount = result.segments?.length ?? 0;
        log.info(`[MEETING:CTRL:HN] stopRecording result meetingId=${result.meetingId} transcriptLen=${transcriptLen} segmentCount=${segmentCount} t=${Date.now()}`);

        log.info("[MEETING:CTRL:HN] transcript preview (first 200 chars):", result.transcript?.slice(0, 200));
        log.info("[MEETING:CTRL:HN] transcript preview (last 200 chars):", result.transcript?.slice(-200));

        // Flush meeting notes before transcript upload
        if (result.meetingId && getNotesRef) {
          const notes = getNotesRef();
          if (notes.trim()) {
            log.info(`[MEETING:CTRL:HN] saveMeetingNotes before call meetingId=${result.meetingId} notesLen=${notes.length} t=${Date.now()}`);
            await saveMeetingNotes(result.meetingId, notes).catch((err) => {
              log.error(`[MEETING:CTRL:HN] saveMeetingNotes failed err=${err instanceof Error ? err.message : err} t=${Date.now()}`);
            });
          }
        }

        if (result.meetingId && (result.transcript || result.segments?.length)) {
          try {
            log.info(`[MEETING:CTRL:HN] uploadMeetingTranscript before call meetingId=${result.meetingId} transcriptLen=${transcriptLen} t=${Date.now()}`);
            await uploadMeetingTranscript(result.meetingId, result.transcript);
            log.info(`[MEETING:CTRL:HN] uploadMeetingTranscript success t=${Date.now()}`);
            log.info(`[MEETING:CTRL:HN] processMeeting before call meetingId=${result.meetingId} t=${Date.now()}`);
            await processMeeting(result.meetingId);
            log.info(`[MEETING:CTRL:HN] processMeeting success t=${Date.now()}`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error(`[MEETING:CTRL:HN] upload/process failed meetingId=${result.meetingId} err=${msg} t=${Date.now()}`);
          }
          showFlash("Saved", FLASH_MEDIUM_MS);
        } else {
          log.warn(`[MEETING:CTRL:HN] no transcript to upload meetingId=${result.meetingId} transcriptLen=${transcriptLen} segmentCount=${segmentCount} t=${Date.now()}`);
          showFlash("Saved", FLASH_SHORT_MS);
        }
      })();
    },
    [dispatch, meetingRecorderRef, showFlash, pillRef, getNotesRef]
  );

  const handleSystemAudioTranscript = useCallback(
    (speaker: number | undefined, text: string) => {
      log.debug(speaker !== undefined ? `Speaker ${speaker}` : "System", text);
    },
    []
  );

  const restoreMeetingState = useCallback(() => {
    log.info(`[MEETING:CTRL:HN] restoreMeetingState called t=${Date.now()}`);
    window.electronAPI?.getMeetingState?.().then((state) => {
      log.info(`[MEETING:CTRL:HN] restoreMeetingState got state active=${state?.active} meetingId=${state?.meetingId} startedAt=${state?.startedAt} t=${Date.now()}`);
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
    log.info(`[MEETING:CTRL:HN] restorePersistedMeeting called t=${Date.now()}`);
    window.electronAPI?.getPersistedMeeting?.().then((persisted) => {
      if (persisted) {
        log.info(`[MEETING:CTRL:HN] restorePersistedMeeting restored meetingId=${persisted.meetingId} startedAt=${persisted.startedAt} t=${Date.now()}`);
        dispatch({
          type: "MEETING_UPDATE",
          active: true,
          meetingId: persisted.meetingId,
          startedAt: persisted.startedAt,
        });
        showFlash("Resumed", FLASH_SHORT_MS);
      } else {
        log.info(`[MEETING:CTRL:HN] restorePersistedMeeting no persisted meeting found t=${Date.now()}`);
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
