// ---------------------------------------------------------------------------
// useFlashMessage — manages flash notifications in the pill overlay
// ---------------------------------------------------------------------------

import { useState, useRef, useCallback } from "react";

export type FlashMessageState = {
  message: string | null;
  show: (msg: string, durationMs: number) => void;
  clear: () => void;
};

export const useFlashMessage = (): FlashMessageState => {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(null);
  }, []);

  const show = useCallback((msg: string, durationMs: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setMessage(msg);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setMessage(null);
    }, durationMs);
  }, []);

  return { message, show, clear };
};
