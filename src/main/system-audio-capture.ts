/**
 * System Audio Capture — macOS ScreenCaptureKit via screencapturekit-audio-capture
 *
 * Runs entirely in the main process. Captures system audio as raw PCM 16kHz
 * mono, streams it via WebSocket to the API server for Deepgram transcription
 * with speaker diarization. Requires macOS 13.0+ (ScreenCaptureKit).
 */

import { systemPreferences } from "electron";
import {
  SILENCE_RMS_THRESHOLD,
  SCK_SILENCE_SKIP_SAMPLES,
  SCK_SILENCE_CHECK_SAMPLES,
  WS_CONNECT_TIMEOUT_MS,
  WS_CLOSE_ACK_TIMEOUT_MS,
} from "@/shared-overlay/constants";

type TranscriptChunk = { speaker?: number; text: string; timestamp: number };

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
  rms: number;
};

type AudioCaptureInstance = {
  captureDisplay: (
    displayId: number,
    options: {
      format?: string;
      channels?: 1 | 2;
      sampleRate?: number;
      minVolume?: number;
    },
  ) => boolean;
  stopCapture: () => void;
  isCapturing: () => boolean;
  getDisplays: () => Array<{
    displayId: number;
    width: number;
    height: number;
    isMainDisplay?: boolean;
  }>;
  dispose: () => void;
  on: (event: string, cb: (...args: unknown[]) => void) => unknown;
  removeAllListeners: () => void;
};

type AudioCaptureConstructor = new () => AudioCaptureInstance;

let capture: AudioCaptureInstance | null = null;
let ws: WebSocket | null = null;
let transcriptChunks: TranscriptChunk[] = [];
let isRunning = false;

const loadAudioCapture = async (): Promise<AudioCaptureConstructor | null> => {
  try {
    const mod = (await import("screencapturekit-audio-capture")) as {
      AudioCapture?: AudioCaptureConstructor;
    };
    return mod.AudioCapture ?? null;
  } catch (err: unknown) {
    console.error(
      `[system-audio] Failed to load screencapturekit-audio-capture: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
};

export const checkSystemAudioPermission = (): boolean => {
  if (process.platform !== "darwin") return true;
  const status = systemPreferences.getMediaAccessStatus("screen");
  return status === "granted";
};

export const startSystemAudioCapture = async (
  meetingId: string,
  apiUrl: string,
  token: string,
): Promise<boolean> => {
  if (isRunning) return true;
  if (process.platform !== "darwin") return false;

  // Don't check permission upfront — just attempt capture.
  // macOS will show the permission prompt when captureDisplay() is called.
  // If already denied, the silence detection below will catch it.
  const permStatus = checkSystemAudioPermission();
  console.log(`[system-audio] Screen Recording permission status: ${permStatus ? "granted" : "not yet granted (will prompt)"}`);

  const AudioCapture = await loadAudioCapture();
  if (!AudioCapture) {
    console.warn(
      "[system-audio] screencapturekit-audio-capture module not available",
    );
    return false;
  }

  transcriptChunks = [];

  const wsBase = apiUrl.replace(/^http/, "ws");
  const wsUrl = `${wsBase}/ws/transcribe?meetingId=${encodeURIComponent(meetingId)}&token=${encodeURIComponent(token)}&source=system&encoding=linear16&sample_rate=16000`;

  try {
    ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("WebSocket timed out")),
        WS_CONNECT_TIMEOUT_MS,
      );

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
        } catch {
          /* not JSON during handshake */
        }
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
  } catch (err: unknown) {
    console.error(
      `[system-audio] WebSocket setup failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    ws?.close();
    ws = null;
    return false;
  }

  // Ongoing message handler
  let sysTranscriptCount = 0;
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as WsMessage;
      if (msg.type === "transcript" && msg.transcript) {
        if (msg.is_final) {
          sysTranscriptCount++;
          transcriptChunks.push({ speaker: msg.speaker, text: msg.transcript, timestamp: Date.now() });
          console.log(`[system-audio] FINAL transcript #${sysTranscriptCount} speaker=${msg.speaker} "${msg.transcript.slice(0, 80)}"`);
        } else {
          console.log(`[system-audio] partial speaker=${msg.speaker} "${msg.transcript.slice(0, 60)}"`);
        }
      } else if (msg.type === "error") {
        console.log(`[system-audio] WS error msg: ${msg.message}`);
      } else if (msg.type === "closed") {
        console.log(`[system-audio] Deepgram stream closed`);
      } else if (msg.type === "reconnecting") {
        console.log(`[system-audio] Deepgram reconnecting...`);
      }
    } catch {
      /* not JSON */
    }
  };
  ws.onerror = () => console.warn("[system-audio] WebSocket error");
  ws.onclose = () => {
    console.log(`[system-audio] WebSocket closed, transcripts captured: ${sysTranscriptCount}`);
    ws = null;
  };

  try {
    capture = new AudioCapture();
    const displays = capture.getDisplays();
    const mainDisplay = displays.find((d) => d.isMainDisplay) ?? displays[0];
    if (!mainDisplay) throw new Error("No displays found for capture");

    let sampleCount = 0;
    let silentSamples = 0;
    let silenceChecked = false;

    capture.on("audio", (rawSample: unknown) => {
      const sample = rawSample as AudioSample;
      sampleCount++;

      if (
        !silenceChecked &&
        sampleCount > SCK_SILENCE_SKIP_SAMPLES &&
        sampleCount <= SCK_SILENCE_SKIP_SAMPLES + SCK_SILENCE_CHECK_SAMPLES
      ) {
        if (sample.rms < SILENCE_RMS_THRESHOLD) silentSamples++;
        if (
          sampleCount ===
          SCK_SILENCE_SKIP_SAMPLES + SCK_SILENCE_CHECK_SAMPLES
        ) {
          silenceChecked = true;
          if (silentSamples === SCK_SILENCE_CHECK_SAMPLES) {
            console.log(
              "[system-audio] No audio detected yet — will transcribe when audio starts playing",
            );
          }
        }
      }

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        if (sampleCount <= 3 || sampleCount % 500 === 0) {
          console.log(`[system-audio] Sample #${sampleCount} dropped, ws=${ws ? `readyState=${ws.readyState}` : "null"}`);
        }
        return;
      }
      ws.send(sample.data);
      if (sampleCount <= 3 || sampleCount % 500 === 0) {
        console.log(`[system-audio] Sample #${sampleCount} sent, size=${sample.data.length} rms=${sample.rms.toFixed(4)}`);
      }
    });

    capture.on("error", (err: unknown) => {
      console.error(
        `[system-audio] Capture error: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    const started = capture.captureDisplay(mainDisplay.displayId, {
      format: "int16",
      channels: 1,
      sampleRate: 16000,
    });

    if (!started) throw new Error("captureDisplay returned false");

    isRunning = true;
    console.log("[system-audio] ScreenCaptureKit started");
    return true;
  } catch (err: unknown) {
    console.error(
      `[system-audio] Start failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    ws?.close();
    ws = null;
    if (capture) {
      try {
        capture.removeAllListeners();
        capture.dispose();
      } catch {
        /* ignore */
      }
      capture = null;
    }
    return false;
  }
};

export type SystemTranscriptSegment = {
  speaker: string;
  text: string;
  timestamp: number;
};

export const stopSystemAudioCapture = async (): Promise<SystemTranscriptSegment[]> => {
  if (!isRunning) return [];
  isRunning = false;

  if (capture) {
    try {
      capture.removeAllListeners();
      capture.stopCapture();
      capture.dispose();
    } catch {
      /* already stopped */
    }
    capture = null;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "CloseStream" }));

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, WS_CLOSE_ACK_TIMEOUT_MS);
      const prevOnMessage = ws!.onmessage;
      ws!.onmessage = (event) => {
        if (prevOnMessage)
          (prevOnMessage as (event: MessageEvent) => void)(event);
        try {
          const msg = JSON.parse(event.data as string) as WsMessage;
          if (msg.type === "closed") {
            clearTimeout(timeout);
            resolve();
          }
        } catch {
          /* not JSON */
        }
      };
    });

    try {
      ws.close();
    } catch {
      /* already closed */
    }
    ws = null;
  }

  const segments: SystemTranscriptSegment[] = transcriptChunks.map((chunk) => ({
    speaker: chunk.speaker !== undefined ? `Remote ${chunk.speaker}` : "Remote",
    text: chunk.text,
    timestamp: chunk.timestamp,
  }));
  transcriptChunks = [];
  return segments;
};
