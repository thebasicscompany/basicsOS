// ---------------------------------------------------------------------------
// Meeting Recorder — dual-stream audio capture (system audio + mic)
// Uses Electron desktopCapturer for system audio and standard getUserMedia for mic.
// Audio is streamed via WebSocket to the API server, which proxies to Deepgram
// for real-time transcription.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from "react";
import {
  SYSTEM_AUDIO_GAIN,
  MIC_AUDIO_GAIN,
  MEDIA_RECORDER_TIMESLICE_MS,
  WS_CONNECT_TIMEOUT_MS,
  WS_CLOSE_ACK_TIMEOUT_MS,
} from "../../../shared/constants.js";
import { createDesktopLogger } from "../../../shared/logger.js";

const log = createDesktopLogger("meeting-recorder");

export type MeetingRecorderState = {
  isRecording: boolean;
  isMicOnly: boolean;
  elapsedMs: number;
  chunkCount: number;
};

export type MeetingRecorderActions = {
  startRecording: (meetingId: string) => Promise<{ micOnly: boolean }>;
  stopRecording: () => Promise<{ meetingId: string | null; transcript: string }>;
};

/** Pick a supported MediaRecorder MIME type for audio. */
const pickMimeType = (): string => {
  const candidates = ["audio/webm;codecs=opus", "audio/webm"];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "audio/webm";
};

/** Stop all tracks on a MediaStream. */
const stopStream = (stream: MediaStream | null): void => {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

/** Build the WebSocket URL for streaming transcription. */
const buildWsUrl = async (meetingId: string): Promise<string> => {
  const apiUrl = (await window.electronAPI?.getApiUrl()) ?? "http://localhost:3001";
  const token = (await window.electronAPI?.getSessionToken()) ?? "";
  // Convert http(s)://... to ws(s)://...
  const wsBase = apiUrl.replace(/^http/, "ws");
  return `${wsBase}/ws/transcribe?meetingId=${encodeURIComponent(meetingId)}&token=${encodeURIComponent(token)}`;
};

/**
 * Custom hook for dual-stream audio capture (system audio via desktopCapturer + mic).
 * Streams audio to the API server via WebSocket for real-time Deepgram transcription.
 */
export const useMeetingRecorder = (
  _chunkIntervalMs?: number, // kept for API compat, no longer used
  onError?: (message: string) => void,
): MeetingRecorderState & MeetingRecorderActions => {
  const [isRecording, setIsRecording] = useState(false);
  const [isMicOnly, setIsMicOnly] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Refs to hold recording infrastructure (survives re-renders)
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meetingIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const transcriptPartsRef = useRef<Array<{ speaker?: number; text: string }>>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const stoppedRef = useRef<boolean>(true);
  // Track mic audio nodes to disconnect on reconnect (prevents pile-up)
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  // Resolved when Deepgram sends "closed" — used by stopRecording to wait for final results
  const closeResolveRef = useRef<(() => void) | null>(null);

  /** Tear down all recording resources. */
  const cleanup = useCallback((): void => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    stopStream(systemStreamRef.current);
    systemStreamRef.current = null;

    stopStream(micStreamRef.current);
    micStreamRef.current = null;

    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }

    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
        wsRef.current.close();
      } catch { /* already closed */ }
      wsRef.current = null;
    }

    meetingIdRef.current = null;
    transcriptPartsRef.current = [];
    stoppedRef.current = true;
  }, []);

  /**
   * Acquire system audio stream via Chromium's getDisplayMedia loopback.
   * Falls back to ScreenCaptureKit capture (main process) if the loopback track
   * arrives dead (Electron 40 bug #49607).
   */
  const getSystemAudioStream = async (): Promise<MediaStream> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error("System audio capture timed out — Screen Recording permission may be denied")), 5000);
    });

    const streamPromise = navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: { width: 4, height: 4, frameRate: 1 } as MediaTrackConstraints,
    });

    try {
      const stream = await Promise.race([streamPromise, timeoutPromise]);
      clearTimeout(timeoutId!);

      // Remove the video track — we only need audio
      for (const videoTrack of stream.getVideoTracks()) {
        videoTrack.stop();
        stream.removeTrack(videoTrack);
      }

      const audioTracks = stream.getAudioTracks();
      log.info(`System audio: ${audioTracks.length} audio tracks, labels: ${audioTracks.map((t) => t.label).join(", ")}`);

      if (audioTracks.length === 0) {
        throw new Error("No audio tracks in display media stream");
      }

      // Detect dead loopback track (Electron 40 bug — track arrives in "ended" state)
      if (audioTracks[0]!.readyState === "ended") {
        log.warn("Loopback audio track is dead (readyState=ended) — Electron audio capture bug");
        stopStream(stream);
        throw new Error("Loopback audio track is dead (readyState=ended)");
      }

      return stream;
    } catch (err) {
      clearTimeout(timeoutId!);
      void streamPromise.then((s) => stopStream(s)).catch(() => undefined);
      throw err;
    }
  };

  const startRecording = useCallback(
    async (meetingId: string): Promise<{ micOnly: boolean }> => {
      if (recorderRef.current) {
        log.info("Already recording, skipping");
        return { micOnly: false };
      }

      log.info(`Starting recording for meeting: ${meetingId}`);
      meetingIdRef.current = meetingId;
      stoppedRef.current = false;
      transcriptPartsRef.current = [];

      // -----------------------------------------------------------------------
      // 1. Set up audio capture FIRST (before WebSocket)
      //    Deepgram has a 10s idle timeout — audio must flow immediately after
      //    the WebSocket opens, so we prepare everything beforehand.
      // -----------------------------------------------------------------------
      let systemStream: MediaStream | null = null;
      let micOnly = false;

      try {
        log.info("Requesting system audio via getDisplayMedia...");
        systemStream = await getSystemAudioStream();
        systemStreamRef.current = systemStream;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errName = err instanceof Error ? err.name : "unknown";
        log.warn(`System audio failed (${errName}): ${errMsg}`);
        log.info("Falling back to mic-only + ScreenCaptureKit system audio");
        micOnly = true;

        // Start ScreenCaptureKit system audio capture in main process as fallback
        try {
          const started = await window.electronAPI?.startSystemAudio?.(meetingId);
          if (started) {
            log.info("ScreenCaptureKit system audio started as fallback");
          } else {
            log.warn("ScreenCaptureKit fallback failed or unavailable");
          }
        } catch (sckErr: unknown) {
          log.error(`ScreenCaptureKit fallback error: ${sckErr instanceof Error ? sckErr.message : String(sckErr)}`);
        }
      }

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      let audioCtx: AudioContext;
      try {
        audioCtx = new AudioContext();
      } catch (err) {
        stopStream(micStream);
        micStreamRef.current = null;
        stopStream(systemStream);
        systemStreamRef.current = null;
        throw err;
      }
      audioCtxRef.current = audioCtx;

      const dest = audioCtx.createMediaStreamDestination();

      if (systemStream) {
        const systemSource = audioCtx.createMediaStreamSource(systemStream);
        const systemGain = audioCtx.createGain();
        systemGain.gain.value = SYSTEM_AUDIO_GAIN;
        systemSource.connect(systemGain);
        systemGain.connect(dest);
      }

      const micSource = audioCtx.createMediaStreamSource(micStream);
      const micGain = audioCtx.createGain();
      micGain.gain.value = MIC_AUDIO_GAIN;
      micSource.connect(micGain);
      micGain.connect(dest);
      micSourceRef.current = micSource;
      micGainRef.current = micGain;

      // Handle device disconnects
      if (systemStream) {
        for (const track of systemStream.getAudioTracks()) {
          track.onended = () => {
            log.warn("System audio track ended unexpectedly");
            void stopRecording();
          };
        }
      }

      for (const track of micStream.getAudioTracks()) {
        track.onended = () => {
          log.warn("Mic track ended — attempting recovery");
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((newMic) => {
              // Disconnect old audio nodes to prevent pile-up
              micSourceRef.current?.disconnect();
              micGainRef.current?.disconnect();
              stopStream(micStreamRef.current);
              micStreamRef.current = newMic;
              const newMicSource = audioCtx.createMediaStreamSource(newMic);
              const newMicGain = audioCtx.createGain();
              newMicGain.gain.value = MIC_AUDIO_GAIN;
              newMicSource.connect(newMicGain);
              newMicGain.connect(dest);
              micSourceRef.current = newMicSource;
              micGainRef.current = newMicGain;
            })
            .catch(() => {
              log.error("Mic recovery failed — stopping");
              void stopRecording();
            });
        };
      }

      // Create MediaRecorder (ready to start, but don't start yet)
      const mimeType = pickMimeType();
      log.info(`${micOnly ? "Mic-only" : "Mixed"} stream — mimeType=${mimeType}`);
      setIsMicOnly(micOnly);

      const recorder = new MediaRecorder(dest.stream, { mimeType });
      recorderRef.current = recorder;

      recorder.onerror = (e) => {
        log.error("MediaRecorder error:", e);
      };

      // -----------------------------------------------------------------------
      // 2. Open WebSocket — audio capture is ready, so we can start recording
      //    immediately after Deepgram says "ready" (no idle gap).
      // -----------------------------------------------------------------------
      const wsUrl = await buildWsUrl(meetingId);
      log.info(`Connecting WebSocket: ${wsUrl.replace(/token=[^&]+/, "token=***")}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Wait for "ready" from server (Deepgram connected)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("WebSocket connection timed out")), WS_CONNECT_TIMEOUT_MS);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string) as { type: string; message?: string };
            if (msg.type === "ready") {
              clearTimeout(timeout);
              resolve();
            } else if (msg.type === "error") {
              clearTimeout(timeout);
              reject(new Error(msg.message ?? "Transcription service error"));
            }
          } catch { /* not JSON, ignore during handshake */ }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("WebSocket connection failed"));
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          reject(new Error("WebSocket closed before ready"));
        };
      });

      log.info("WebSocket connected, Deepgram ready");

      // -----------------------------------------------------------------------
      // 3. Start recording IMMEDIATELY — Deepgram's 10s idle timer is running
      // -----------------------------------------------------------------------

      // Wire up audio streaming
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size === 0 || stoppedRef.current) return;
        const currentWs = wsRef.current;
        if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return;

        void event.data.arrayBuffer().then((buffer) => {
          if (stoppedRef.current) return;
          if (currentWs.readyState === WebSocket.OPEN) {
            currentWs.send(buffer);
          }
        });
      };

      // Start recording — audio flows to Deepgram within 250ms
      recorder.start(MEDIA_RECORDER_TIMESLICE_MS);

      // Set up ongoing message handler for transcription results
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            transcript?: string;
            speaker?: number;
            is_final?: boolean;
            speech_final?: boolean;
            message?: string;
          };

          if (msg.type === "transcript" && msg.transcript) {
            if (msg.is_final) {
              transcriptPartsRef.current.push({ speaker: msg.speaker, text: msg.transcript });
              setChunkCount((prev) => prev + 1);
              log.debug(`Transcript (final, speaker=${msg.speaker ?? "?"}): "${msg.transcript.slice(0, 80)}${msg.transcript.length > 80 ? "..." : ""}"`);
            }
          } else if (msg.type === "reconnecting") {
            log.info(`Server reconnecting to Deepgram (attempt ${(msg as { attempt?: number }).attempt ?? "?"})`);
          } else if (msg.type === "error") {
            log.error(`Server error: ${msg.message ?? "unknown"}`);
            onErrorRef.current?.(`Transcription error: ${msg.message ?? "unknown"}`);
          } else if (msg.type === "closed") {
            const reason = (msg as { reason?: string }).reason;
            if (reason === "max_retries") {
              log.error("Deepgram reconnection exhausted — transcription lost");
              onErrorRef.current?.("Transcription connection lost");
            } else {
              log.info("Deepgram stream closed by server");
            }
            closeResolveRef.current?.();
            closeResolveRef.current = null;
          }
        } catch { /* not JSON */ }
      };

      ws.onerror = (event) => {
        log.error("WebSocket error:", event);
      };

      ws.onclose = () => {
        log.info("WebSocket closed");
        wsRef.current = null;
      };

      // -----------------------------------------------------------------------
      // 4. Start elapsed timer + update state
      // -----------------------------------------------------------------------
      startTimeRef.current = Date.now();
      elapsedTimerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 1000);

      setIsRecording(true);
      setIsMicOnly(micOnly);
      setElapsedMs(0);
      setChunkCount(0);

      return { micOnly };
    },
    [],
  );

  const stopRecording = useCallback(async (): Promise<{ meetingId: string | null; transcript: string }> => {
    log.info("stopRecording() called");
    stoppedRef.current = true;
    const mid = meetingIdRef.current;
    const recorder = recorderRef.current;

    // Stop MediaRecorder to flush final audio
    if (recorder && recorder.state !== "inactive") {
      // Wait for final ondataavailable + send it
      await new Promise<void>((resolve) => {
        const onData = (event: BlobEvent): void => {
          recorder.removeEventListener("dataavailable", onData);
          if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
            void event.data.arrayBuffer().then((buffer) => {
              wsRef.current?.send(buffer);
              resolve();
            });
          } else {
            resolve();
          }
        };
        recorder.addEventListener("dataavailable", onData);
        recorder.stop();
      });
    }

    // Tell Deepgram to finalize and wait for "closed" acknowledgement
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "CloseStream" }));

      // Wait for the existing onmessage handler to receive "closed" (max 2s)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, WS_CLOSE_ACK_TIMEOUT_MS);
        closeResolveRef.current = () => { clearTimeout(timeout); resolve(); };
      });
      closeResolveRef.current = null;
    }

    // Stop ScreenCaptureKit system audio if it was running as fallback
    let systemTranscript = "";
    try {
      systemTranscript = (await window.electronAPI?.stopSystemAudio?.()) ?? "";
      if (systemTranscript) {
        log.info(`System audio transcript: ${systemTranscript.length} chars`);
      }
    } catch { /* system audio capture wasn't running */ }

    // Assemble final transcript with speaker labels
    // Speaker 0 is assumed to be the local user (mic), others are labeled Speaker N
    const parts = transcriptPartsRef.current;
    const lines = parts.map((part) => {
      if (part.speaker === undefined) return part.text;
      const label = part.speaker === 0 ? "You" : `Speaker ${part.speaker}`;
      return `${label}: ${part.text}`;
    });
    // Append system audio transcript (already labeled with "Remote N:" prefixes)
    if (systemTranscript) {
      lines.push(systemTranscript);
    }
    const transcript = lines.join("\n");
    log.info(`Final transcript: ${transcript.length} chars, ${parts.length} parts`);
    transcriptPartsRef.current = [];

    // Clean up everything
    recorderRef.current = null;

    stopStream(systemStreamRef.current);
    systemStreamRef.current = null;

    stopStream(micStreamRef.current);
    micStreamRef.current = null;

    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }

    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }

    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* already closed */ }
      wsRef.current = null;
    }

    meetingIdRef.current = null;
    setIsRecording(false);
    setIsMicOnly(false);
    setElapsedMs(0);

    return { meetingId: mid, transcript };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    isMicOnly,
    elapsedMs,
    chunkCount,
    startRecording,
    stopRecording,
  };
};
