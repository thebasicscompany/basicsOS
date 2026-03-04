import { synthesizeSpeech } from "../api";

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

const speakWebSpeech = (
  text: string,
  opts?: { rate?: number; pitch?: number; volume?: number }
): void => {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = opts?.rate ?? 1.05;
    utterance.pitch = opts?.pitch ?? 1;
    utterance.volume = opts?.volume ?? 0.8;
    window.speechSynthesis.speak(utterance);
  } catch {
    // ignore
  }
};

export const speak = async (
  text: string,
  opts?: { rate?: number; pitch?: number; volume?: number }
): Promise<void> => {
  try {
    const buffer = await synthesizeSpeech(text);
    if (buffer) {
      await playAudioBuffer(buffer);
      return;
    }
  } catch {
    // fall through
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
