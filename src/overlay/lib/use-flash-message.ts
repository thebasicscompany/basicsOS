import { useState, useRef, useCallback } from "react";

const FADE_OUT_MS = 400;

export type FlashMessageState = {
  message: string | null;
  fading: boolean;
  show: (msg: string, durationMs: number) => void;
  clear: () => void;
};

export const useFlashMessage = (): FlashMessageState => {
  const [message, setMessage] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setFading(false);
    setMessage(null);
  }, []);

  const show = useCallback((msg: string, durationMs: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setFading(false);
    setMessage(msg);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      // Start fade-out
      setFading(true);
      fadeTimerRef.current = setTimeout(() => {
        fadeTimerRef.current = null;
        setFading(false);
        setMessage(null);
      }, FADE_OUT_MS);
    }, durationMs);
  }, []);

  return { message, fading, show, clear };
};
