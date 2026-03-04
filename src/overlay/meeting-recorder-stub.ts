// Stub meeting recorder — no WebSocket, no real recording.
// When basicsAdmin adds meetings support, replace with real implementation.

import { useRef, useCallback } from "react";

export type MeetingRecorderActions = {
  startRecording: (meetingId: string) => Promise<{ micOnly: boolean }>;
  stopRecording: () => Promise<{ meetingId: string | null; transcript: string }>;
};

export const useMeetingRecorder = (
  _chunkIntervalMs?: number,
  onError?: (message: string) => void
): MeetingRecorderActions => {
  const meetingIdRef = useRef<string | null>(null);

  const startRecording = useCallback(async (mid: string) => {
    meetingIdRef.current = mid;
    onError?.("Meeting recording requires backend support — stubbed");
    return { micOnly: true };
  }, [onError]);

  const stopRecording = useCallback(async () => {
    const mid = meetingIdRef.current;
    meetingIdRef.current = null;
    return { meetingId: mid, transcript: "" };
  }, []);

  return { startRecording, stopRecording };
};
