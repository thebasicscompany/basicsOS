// ---------------------------------------------------------------------------
// System Audio Capture — macOS ScreenCaptureKit via screencapturekit-audio-capture
//
// Runs entirely in the main process. Captures system audio as raw PCM 16kHz
// mono, streams it via WebSocket to the API server for Deepgram transcription
// with speaker diarization. Requires macOS 13.0+ (ScreenCaptureKit).
//
// Uses a native N-API addon that calls ScreenCaptureKit directly — works with
// ALL output devices including Bluetooth (captures at the OS level before audio
// reaches the output device). Requires "Screen Recording" TCC permission.
// ---------------------------------------------------------------------------

import { systemPreferences, shell } from "electron";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SystemAudioOptions = {
  /** Called if the first N audio chunks are all silence (likely permission issue). */
  onSilenceDetected?: () => void;
  /** Called with each final transcript chunk (for forwarding to renderer). */
  onTranscript?: (speaker: number | undefined, text: string) => void;
};

type TranscriptChunk = {
  speaker?: number;
  text: string;
};

type WsMessage = {
  type: string;
  transcript?: string;
  speaker?: number;
  is_final?: boolean;
  message?: string;
};

type AudioSample = {
  data: Buffer;
  sampleRate: number;
  channels: number;
  timestamp: number;
  format: string;
  sampleCount: number;
  framesCount: number;
  durationMs: number;
  rms: number;
  peak: number;
};

type AudioCaptureInstance = {
  captureDisplay: (displayId: number, options: {
    format?: string;
    channels?: 1 | 2;
    sampleRate?: number;
    minVolume?: number;
  }) => boolean;
  stopCapture: () => void;
  isCapturing: () => boolean;
  getDisplays: () => Array<{ displayId: number; width: number; height: number; isMainDisplay?: boolean }>;
  dispose: () => void;
  on: (event: string, cb: (...args: unknown[]) => void) => unknown;
};

type AudioCaptureConstructor = new () => AudioCaptureInstance;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let capture: AudioCaptureInstance | null = null;
let ws: WebSocket | null = null;
let transcriptChunks: TranscriptChunk[] = [];
let isRunning = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const log = (msg: string): void => {
  console.log(`[system-audio] ${msg}`);
};

/** Dynamically import screencapturekit-audio-capture. Returns null if unavailable. */
const loadAudioCapture = async (): Promise<AudioCaptureConstructor | null> => {
  try {
    const mod = await import("screencapturekit-audio-capture") as { AudioCapture?: AudioCaptureConstructor };
    return mod.AudioCapture ?? null;
  } catch (err: unknown) {
    log(`Failed to load screencapturekit-audio-capture: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Permission check
// ---------------------------------------------------------------------------

/**
 * Check if "Screen Recording" permission is granted.
 * Returns `true` if granted, `false` otherwise.
 */
export const checkSystemAudioPermission = (): boolean => {
  if (process.platform !== "darwin") return true;
  const status = systemPreferences.getMediaAccessStatus("screen");
  return status === "granted";
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start capturing system audio and streaming to the API for transcription.
 * Returns `true` if system audio started successfully, `false` if unsupported/failed.
 */
export const startSystemAudioCapture = async (
  meetingId: string,
  apiUrl: string,
  token: string,
  options?: SystemAudioOptions,
): Promise<boolean> => {
  if (isRunning) {
    log("Already running, skipping");
    return true;
  }

  if (process.platform !== "darwin") {
    log("macOS required for ScreenCaptureKit — skipping system audio");
    return false;
  }

  // Check Screen Recording permission
  const screenStatus = systemPreferences.getMediaAccessStatus("screen");
  const micStatus = systemPreferences.getMediaAccessStatus("microphone");
  log(`Permission check: screen=${screenStatus}, microphone=${micStatus}`);
  if (!checkSystemAudioPermission()) {
    log("Screen Recording permission not granted — opening System Settings");
    shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture").catch(() => {});
    return false;
  }

  const AudioCapture = await loadAudioCapture();
  if (!AudioCapture) {
    log("screencapturekit-audio-capture module not available — skipping system audio");
    return false;
  }

  transcriptChunks = [];

  // Build WebSocket URL for system audio stream
  const wsBase = apiUrl.replace(/^http/, "ws");
  const wsUrl = `${wsBase}/ws/transcribe?meetingId=${encodeURIComponent(meetingId)}&token=${encodeURIComponent(token)}&source=system&encoding=linear16&sample_rate=16000`;
  log(`Connecting WebSocket: ${wsUrl.replace(/token=[^&]+/, "token=***")}`);

  // Open WebSocket and wait for "ready"
  try {
    ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WebSocket timed out")), 10_000);

      ws!.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WsMessage;
          if (msg.type === "ready") {
            clearTimeout(timeout);
            resolve();
          } else if (msg.type === "error") {
            clearTimeout(timeout);
            reject(new Error(msg.message ?? "Server error"));
          }
        } catch { /* not JSON during handshake */ }
      };

      ws!.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("WebSocket connection failed"));
      };

      ws!.onclose = () => {
        clearTimeout(timeout);
        reject(new Error("WebSocket closed before ready"));
      };
    });

    log("WebSocket connected, Deepgram ready");
  } catch (err: unknown) {
    log(`WebSocket setup failed: ${err instanceof Error ? err.message : String(err)}`);
    ws?.close();
    ws = null;
    return false;
  }

  // Set up ongoing message handler for transcript results
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as WsMessage;
      if (msg.type === "transcript" && msg.transcript && msg.is_final) {
        transcriptChunks.push({
          speaker: msg.speaker,
          text: msg.transcript,
        });
        log(`Transcript (speaker=${msg.speaker ?? "?"}): "${msg.transcript.slice(0, 60)}..."`);
        options?.onTranscript?.(msg.speaker, msg.transcript);
      }
    } catch { /* not JSON */ }
  };

  ws.onerror = () => {
    log("WebSocket error");
  };

  ws.onclose = () => {
    log("WebSocket closed");
    ws = null;
  };

  // Create AudioCapture instance and start display capture
  try {
    capture = new AudioCapture();

    // Find the main display
    const displays = capture.getDisplays();
    const mainDisplay = displays.find((d) => d.isMainDisplay) ?? displays[0];
    if (!mainDisplay) {
      throw new Error("No displays found for capture");
    }
    log(`Found ${displays.length} display(s), capturing displayId=${mainDisplay.displayId} (${mainDisplay.width}x${mainDisplay.height})`);

    // Audio data event — sample.data is a Buffer of 16-bit signed PCM mono audio
    let sampleCount = 0;
    // ScreenCaptureKit has ~1s startup latency where initial samples are silent.
    // Check 25 samples (~0.5s of audio at 20ms chunks) AFTER skipping the first 25
    // to avoid false-positive silence detection during normal startup.
    const SILENCE_SKIP_SAMPLES = 25;
    const SILENCE_CHECK_SAMPLES = 25;
    let silentSamples = 0;
    let silenceChecked = false;

    capture.on("audio", (rawSample: unknown) => {
      const sample = rawSample as AudioSample;
      sampleCount++;

      // Log diagnostics at key milestones
      if (sampleCount <= 3 || sampleCount === 10 || sampleCount === 50) {
        log(`audio #${sampleCount}: ${sample.data.length}B, rms=${sample.rms.toFixed(4)}, rate=${sample.sampleRate}, ch=${sample.channels}, ws=${ws?.readyState ?? "null"}`);
      }

      // Silence detection: skip startup samples, then check a window for permission issues
      if (!silenceChecked && sampleCount > SILENCE_SKIP_SAMPLES && sampleCount <= SILENCE_SKIP_SAMPLES + SILENCE_CHECK_SAMPLES) {
        if (sample.rms === 0) silentSamples++;

        if (sampleCount === SILENCE_SKIP_SAMPLES + SILENCE_CHECK_SAMPLES) {
          silenceChecked = true;
          if (silentSamples === SILENCE_CHECK_SAMPLES) {
            log("All post-startup audio samples are silence — likely permission issue");
            options?.onSilenceDetected?.();
          } else {
            log(`Silence check passed: ${SILENCE_CHECK_SAMPLES - silentSamples}/${SILENCE_CHECK_SAMPLES} samples had audio`);
          }
        }
      }

      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(sample.data);
    });

    capture.on("error", (err: unknown) => {
      const error = err as Error;
      log(`Capture error: ${error.message ?? String(err)}`);
    });

    // Start capturing the main display audio
    // format: int16 for Deepgram, mono channel, 16kHz sample rate
    const started = capture.captureDisplay(mainDisplay.displayId, {
      format: "int16",
      channels: 1,
      sampleRate: 16000,
    });

    if (!started) {
      throw new Error("captureDisplay returned false — capture failed to start");
    }

    isRunning = true;
    log("ScreenCaptureKit started — capturing system audio via display capture");
    return true;
  } catch (err: unknown) {
    log(`ScreenCaptureKit start failed: ${err instanceof Error ? err.message : String(err)}`);
    ws?.close();
    ws = null;
    if (capture) {
      try { capture.dispose(); } catch { /* ignore */ }
      capture = null;
    }
    return false;
  }
};

/**
 * Stop system audio capture and return the buffered transcript formatted
 * with speaker labels (e.g. "Remote 0: text").
 */
export const stopSystemAudioCapture = async (): Promise<string> => {
  if (!isRunning) return "";

  log("Stopping...");
  isRunning = false;

  // Stop ScreenCaptureKit capture
  if (capture) {
    try {
      capture.stopCapture();
      capture.dispose();
    } catch { /* already stopped */ }
    capture = null;
  }

  // Send CloseStream and wait for "closed" acknowledgement
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "CloseStream" }));

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 2000);
      const prevOnMessage = ws!.onmessage;
      ws!.onmessage = (event) => {
        if (prevOnMessage) {
          (prevOnMessage as (event: MessageEvent) => void)(event);
        }
        try {
          const msg = JSON.parse(event.data as string) as WsMessage;
          if (msg.type === "closed") {
            clearTimeout(timeout);
            resolve();
          }
        } catch { /* not JSON */ }
      };
    });

    try { ws.close(); } catch { /* already closed */ }
    ws = null;
  }

  // Format transcript with speaker labels
  const lines = transcriptChunks.map((chunk) => {
    const label = chunk.speaker !== undefined ? `Remote ${chunk.speaker}` : "Remote";
    return `${label}: ${chunk.text}`;
  });

  const transcript = lines.join("\n");
  log(`Final transcript: ${transcript.length} chars, ${transcriptChunks.length} chunks`);
  transcriptChunks = [];

  return transcript;
};

/** Check if system audio capture is currently running. */
export const isSystemAudioRunning = (): boolean => isRunning;
