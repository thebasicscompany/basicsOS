/**
 * TTS — tries Deepgram (via basicsOS API proxy → infra gateway) first,
 * falls back to Web Speech Synthesis if the gateway is unavailable.
 */

import { synthesizeSpeech } from "../api";

// ---------------------------------------------------------------------------
// Audio element for gateway TTS (mp3 playback + cancel support)
// ---------------------------------------------------------------------------

let currentAudio: HTMLAudioElement | null = null;

const playAudioBuffer = (buffer: ArrayBuffer): Promise<void> =>
  new Promise((resolve) => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const blob = new Blob([buffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      resolve();
    };
    void audio.play();
  });

// ---------------------------------------------------------------------------
// Web Speech fallback
// ---------------------------------------------------------------------------

type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
};

const speakWebSpeech = (text: string, opts?: SpeakOptions): void => {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = opts?.rate ?? 1.05;
    utterance.pitch = opts?.pitch ?? 1;
    utterance.volume = opts?.volume ?? 0.8;
    window.speechSynthesis.speak(utterance);
  } catch {
    // TTS not available — silent no-op
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const speak = async (text: string, opts?: SpeakOptions): Promise<void> => {
  try {
    const buffer = await synthesizeSpeech(text);
    if (buffer) {
      await playAudioBuffer(buffer);
      return;
    }
  } catch {
    // Gateway unavailable — fall through to Web Speech
  }
  speakWebSpeech(text, opts);
};

export const cancel = (): void => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
};

export const isSpeaking = (): boolean => {
  if (currentAudio && !currentAudio.paused) return true;
  try {
    return window.speechSynthesis?.speaking ?? false;
  } catch {
    return false;
  }
};
