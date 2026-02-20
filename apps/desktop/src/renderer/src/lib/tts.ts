// ---------------------------------------------------------------------------
// Simple Web Speech TTS wrapper
// ---------------------------------------------------------------------------

type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
};

export const speak = (text: string, opts?: SpeakOptions): void => {
  try {
    if (!window.speechSynthesis) return;
    cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = opts?.rate ?? 1.05;
    utterance.pitch = opts?.pitch ?? 1;
    utterance.volume = opts?.volume ?? 0.8;
    window.speechSynthesis.speak(utterance);
  } catch {
    // TTS not available — silent no-op
  }
};

export const cancel = (): void => {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
};

export const isSpeaking = (): boolean => {
  try {
    return window.speechSynthesis?.speaking ?? false;
  } catch {
    return false;
  }
};
