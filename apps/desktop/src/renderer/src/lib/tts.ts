// ---------------------------------------------------------------------------
// Simple Web Speech TTS wrapper
// ---------------------------------------------------------------------------

export const speak = (text: string): void => {
  try {
    if (!window.speechSynthesis) return;
    cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.volume = 0.8;
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
