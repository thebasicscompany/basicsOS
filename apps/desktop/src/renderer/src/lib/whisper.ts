import { useState, useRef, useCallback, useEffect } from "react";
import { MIN_TRANSCRIPTION_BLOB_SIZE } from "../../../shared/constants.js";
import { createDesktopLogger } from "../../../shared/logger.js";
import { transcribeAudioBlob } from "../api";

const log = createDesktopLogger("whisper");

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
// Hook: useSpeechRecognition — MediaRecorder + Deepgram transcription
// ---------------------------------------------------------------------------

export type SpeechRecognitionState = {
  isListening: boolean;
  transcript: string;
  interimText: string;
  startListening: () => void;
  stopListening: () => Promise<string>;
};

export const useSpeechRecognition = (): SpeechRecognitionState => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup media tracks on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(() => {
    playStartChime();
    setIsListening(true);
    setTranscript("");
    setInterimText("");
    chunksRef.current = [];

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      })
      .then((stream) => {
        streamRef.current = stream;

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onerror = () => {
          setIsListening(false);
          stopMediaTracks();
        };

        recorder.start();
        setInterimText("Recording...");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Microphone access denied";
        log.error("getUserMedia failed:", msg);
        setIsListening(false);
        setInterimText(msg);
      });
  }, []);

  const stopMediaTracks = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  const stopListening = useCallback(async (): Promise<string> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      log.debug("stopListening: recorder inactive or null — returning empty");
      setIsListening(false);
      playStopChime();
      stopMediaTracks();
      return "";
    }

    // Wait for the recorder to finish and collect all data
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const chunks = chunksRef.current;
        const mimeType = recorder.mimeType || "audio/webm";
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.stop();
    });

    log.debug(`stopListening: blob.size=${blob.size}, mimeType=${blob.type}, chunks=${chunksRef.current.length}`);

    playStopChime();
    setIsListening(false);
    stopMediaTracks();
    setInterimText("Transcribing...");

    // Skip transcription for very short recordings (likely no speech)
    if (blob.size < MIN_TRANSCRIPTION_BLOB_SIZE) {
      log.debug(`stopListening: blob too small (${blob.size} < ${MIN_TRANSCRIPTION_BLOB_SIZE}) — skipping transcription`);
      setTranscript("");
      setInterimText("");
      return "";
    }

    let text = "";
    try {
      const result = await transcribeAudioBlob(blob);
      text = result ?? "";
    } catch (err: unknown) {
      log.error("Transcription error:", err instanceof Error ? err.message : err);
    }
    log.debug(`transcription result: "${text}" (${text.length} chars)`);
    setTranscript(text);
    setInterimText("");
    return text;
  }, [stopMediaTracks]);

  return { isListening, transcript, interimText, startListening, stopListening };
};
