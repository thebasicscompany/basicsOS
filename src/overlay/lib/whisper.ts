import { useState, useRef, useCallback, useEffect } from "react";
import { MIN_TRANSCRIPTION_BLOB_SIZE } from "../../shared-overlay/constants";
import { createOverlayLogger } from "./overlay-logger";
import { transcribeAudioBlob } from "../api";

const log = createOverlayLogger("whisper");

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
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + duration
    );
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch {
    // ignore
  }
};

const playStartChime = () => playChime(880, 0.15);
const playStopChime = () => playChime(440, 0.2);

/** RMS threshold below which we consider silence. Tune if needed. */
const VAD_SILENCE_THRESHOLD = 0.008;
const VAD_POLL_MS = 100;

const runVoiceActivityDetection = (
  stream: MediaStream,
  silenceTimeoutMs: number,
  onSilence: () => void
): (() => void) => {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  source.connect(analyser);
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.5;
  const data = new Uint8Array(analyser.fftSize);

  let lastVoiceAt = Date.now();
  let cancelled = false;

  const poll = (): void => {
    if (cancelled) return;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i]! - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    if (rms > VAD_SILENCE_THRESHOLD) {
      lastVoiceAt = Date.now();
    } else if (Date.now() - lastVoiceAt >= silenceTimeoutMs) {
      onSilence();
      return;
    }
    setTimeout(poll, VAD_POLL_MS);
  };
  poll();

  return () => {
    cancelled = true;
    ctx.close();
  };
};

export type SpeechRecognitionOptions = {
  onSilence?: () => void;
  silenceTimeoutMs?: number;
};

export type SpeechRecognitionState = {
  isListening: boolean;
  transcript: string;
  interimText: string;
  startListening: () => void;
  stopListening: () => Promise<string>;
};

export const useSpeechRecognition = (
  options?: SpeechRecognitionOptions
): SpeechRecognitionState => {
  const { onSilence, silenceTimeoutMs = 2000 } = options ?? {};
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const vadCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      vadCleanupRef.current?.();
      vadCleanupRef.current = null;
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
    vadCleanupRef.current?.();
    vadCleanupRef.current = null;

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
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onerror = () => {
          setIsListening(false);
          vadCleanupRef.current?.();
          vadCleanupRef.current = null;
          if (streamRef.current) {
            for (const track of streamRef.current.getTracks()) track.stop();
            streamRef.current = null;
          }
        };

        recorder.start();
        setInterimText("Recording...");

        if (onSilence && silenceTimeoutMs > 0) {
          vadCleanupRef.current = runVoiceActivityDetection(
            stream,
            silenceTimeoutMs,
            onSilence
          );
        }
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Microphone access denied";
        log.error("getUserMedia failed:", msg);
        setIsListening(false);
        setInterimText(msg);
      });
  }, [onSilence, silenceTimeoutMs]);

  const stopMediaTracks = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);

  const stopListening = useCallback(async (): Promise<string> => {
    vadCleanupRef.current?.();
    vadCleanupRef.current = null;

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsListening(false);
      playStopChime();
      stopMediaTracks();
      return "";
    }

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        resolve(new Blob(chunksRef.current, { type: mimeType }));
      };
      recorder.stop();
    });

    playStopChime();
    setIsListening(false);
    stopMediaTracks();
    setInterimText("Transcribing...");

    if (blob.size < MIN_TRANSCRIPTION_BLOB_SIZE) {
      setTranscript("");
      setInterimText("");
      return "";
    }

    let text = "";
    try {
      const result = await transcribeAudioBlob(blob);
      text = result ?? "";
    } catch (err) {
      log.error("Transcription error:", err);
    }
    setTranscript(text);
    setInterimText("");
    return text;
  }, [stopMediaTracks]);

  return { isListening, transcript, interimText, startListening, stopListening };
};
