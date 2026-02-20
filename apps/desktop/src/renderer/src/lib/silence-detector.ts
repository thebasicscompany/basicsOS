// ---------------------------------------------------------------------------
// Silence detector — fires callback when transcript is stable for timeoutMs
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";

export const useSilenceDetector = (
  transcript: string,
  timeoutMs: number,
  onSilence: () => void,
  enabled: boolean,
): void => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSilenceRef = useRef(onSilence);
  onSilenceRef.current = onSilence;

  useEffect(() => {
    if (!enabled || !transcript) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Reset timer on each transcript change
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onSilenceRef.current();
    }, timeoutMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [transcript, timeoutMs, enabled]);
};
