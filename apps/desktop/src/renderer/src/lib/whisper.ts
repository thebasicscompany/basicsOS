import { useState, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// Audio cue: tiny chime via AudioContext (no file dependency)
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null;

const playChime = (frequency: number, duration: number): void => {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = frequency;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch {
    // Audio not available
  }
};

const playStartChime = (): void => playChime(880, 0.15);
const playStopChime = (): void => playChime(440, 0.2);

// ---------------------------------------------------------------------------
// SpeechRecognition types
// ---------------------------------------------------------------------------

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
};
type SpeechRecognitionResultList = Array<SpeechRecognitionResult>;
type SpeechRecognitionResult = { isFinal: boolean } & Array<{ transcript: string }>;
type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
    require?: (module: string) => unknown;
  }
}

// ---------------------------------------------------------------------------
// Hook: useSpeechRecognition — pure recognition, no AI integration
// ---------------------------------------------------------------------------

export type SpeechRecognitionState = {
  isListening: boolean;
  transcript: string;
  interimText: string;
  startListening: () => void;
  stopListening: () => string;
};

export const useSpeechRecognition = (): SpeechRecognitionState => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    setIsListening(true);
    setTranscript("");
    setInterimText("");
    transcriptRef.current = "";
    playStartChime();

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (e) => {
      let final = "";
      let interim = "";
      for (const result of Array.from(e.results) as SpeechRecognitionResultList) {
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          final += text + " ";
        } else {
          interim += text;
        }
      }
      const combined = (final + interim).trim();
      transcriptRef.current = combined;
      setTranscript(combined);
      // Show last few words as interim indicator
      const words = combined.split(/\s+/);
      setInterimText(words.slice(-6).join(" "));
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      // Fires when recognition stops naturally
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, []);

  const stopListening = useCallback((): string => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    playStopChime();
    return transcriptRef.current.trim();
  }, []);

  return { isListening, transcript, interimText, startListening, stopListening };
};
