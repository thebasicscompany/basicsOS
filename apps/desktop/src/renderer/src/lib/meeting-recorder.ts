// ---------------------------------------------------------------------------
// Meeting Recorder — dual-stream audio capture (system audio + mic)
// Uses Electron desktopCapturer for system audio and standard getUserMedia for mic.
// Audio is streamed via WebSocket to the API server, which proxies to Deepgram
// for real-time transcription.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from "react";

/** Forward a log line to both DevTools console and main process stdout. */
const rlog = (msg: string): void => {
  console.log(msg);
  window.electronAPI?.logToMain?.(msg);
};

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

// MediaRecorder timeslice — how often ondataavailable fires.
// Smaller = lower latency for streaming. 250ms is a good balance.
const MEDIA_RECORDER_TIMESLICE_MS = 250;

/**
 * Custom hook for dual-stream audio capture (system audio via desktopCapturer + mic).
 * Streams audio to the API server via WebSocket for real-time Deepgram transcription.
 */
export const useMeetingRecorder = (
  _chunkIntervalMs?: number, // kept for API compat, no longer used
): MeetingRecorderState & MeetingRecorderActions => {
  const [isRecording, setIsRecording] = useState(false);
  const [isMicOnly, setIsMicOnly] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);

  // Refs to hold recording infrastructure (survives re-renders)
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meetingIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const transcriptPartsRef = useRef<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const stoppedRef = useRef<boolean>(true);
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

  /** Acquire system audio stream via Electron desktopCapturer (with 5s timeout). */
  const getSystemAudioStream = async (sourceId: string): Promise<MediaStream> => {
    const streamPromise = navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: sourceId,
        },
      } as unknown as MediaStreamConstraints["audio"],
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: sourceId,
          maxWidth: 1,
          maxHeight: 1,
        },
      } as unknown as MediaStreamConstraints["video"],
    });

    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error("System audio capture timed out — Screen Recording permission may be denied")), 5000);
    });

    try {
      const stream = await Promise.race([streamPromise, timeoutPromise]);
      clearTimeout(timeoutId!);

      // Remove the tiny video track — we only need audio
      for (const videoTrack of stream.getVideoTracks()) {
        videoTrack.stop();
        stream.removeTrack(videoTrack);
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
        rlog("[meeting-recorder] Already recording, skipping");
        return { micOnly: false };
      }

      rlog(`[meeting-recorder] Starting recording for meeting: ${meetingId}`);
      meetingIdRef.current = meetingId;
      stoppedRef.current = false;
      transcriptPartsRef.current = [];

      // -----------------------------------------------------------------------
      // 1. Open WebSocket to API server for streaming transcription
      // -----------------------------------------------------------------------
      const wsUrl = await buildWsUrl(meetingId);
      rlog(`[meeting-recorder] Connecting WebSocket: ${wsUrl.replace(/token=[^&]+/, "token=***")}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Wait for either "ready" from server (Deepgram connected) or error
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("WebSocket connection timed out")), 10_000);

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

      rlog("[meeting-recorder] WebSocket connected, Deepgram ready");

      // Set up ongoing message handler for transcription results
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            transcript?: string;
            is_final?: boolean;
            speech_final?: boolean;
            message?: string;
          };

          if (msg.type === "transcript" && msg.transcript) {
            if (msg.is_final) {
              // Final result for this utterance — append to transcript
              transcriptPartsRef.current.push(msg.transcript);
              setChunkCount((prev) => prev + 1);
              rlog(`[meeting-recorder] Transcript (final): "${msg.transcript.slice(0, 80)}${msg.transcript.length > 80 ? "..." : ""}"`);
            }
          } else if (msg.type === "error") {
            rlog(`[meeting-recorder] Server error: ${msg.message ?? "unknown"}`);
          } else if (msg.type === "closed") {
            rlog("[meeting-recorder] Deepgram stream closed by server");
            // If stopRecording is waiting for this, resolve the promise
            closeResolveRef.current?.();
            closeResolveRef.current = null;
          }
        } catch { /* not JSON */ }
      };

      ws.onerror = (event) => {
        console.error("[meeting-recorder] WebSocket error:", event);
      };

      ws.onclose = () => {
        rlog("[meeting-recorder] WebSocket closed");
        wsRef.current = null;
      };

      // -----------------------------------------------------------------------
      // 2. Try to get system audio
      // -----------------------------------------------------------------------
      let systemStream: MediaStream | null = null;
      let micOnly = false;

      try {
        rlog("[meeting-recorder] Getting desktop capture sources...");
        const sources = await window.electronAPI?.getDesktopSources();
        if (!sources || sources.length === 0) {
          throw new Error("No desktop capture sources available");
        }
        const sourceId = sources[0]!.id;
        rlog(`[meeting-recorder] Using source: ${sources[0]!.name} (${sourceId})`);

        systemStream = await getSystemAudioStream(sourceId);
        systemStreamRef.current = systemStream;
        rlog(`[meeting-recorder] System audio: ${systemStream.getAudioTracks().length} tracks`);
      } catch (err: unknown) {
        rlog(`[meeting-recorder] System audio failed, mic-only: ${err instanceof Error ? err.message : String(err)}`);
        micOnly = true;
      }

      // -----------------------------------------------------------------------
      // 3. Get mic stream
      // -----------------------------------------------------------------------
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      // -----------------------------------------------------------------------
      // 4. Build AudioContext mixer
      // -----------------------------------------------------------------------
      let audioCtx: AudioContext;
      try {
        audioCtx = new AudioContext();
      } catch (err) {
        stopStream(micStream);
        micStreamRef.current = null;
        stopStream(systemStream);
        systemStreamRef.current = null;
        ws.close();
        wsRef.current = null;
        throw err;
      }
      audioCtxRef.current = audioCtx;

      const dest = audioCtx.createMediaStreamDestination();

      if (systemStream) {
        const systemSource = audioCtx.createMediaStreamSource(systemStream);
        const systemGain = audioCtx.createGain();
        systemGain.gain.value = 0.7;
        systemSource.connect(systemGain);
        systemGain.connect(dest);
      }

      const micSource = audioCtx.createMediaStreamSource(micStream);
      const micGain = audioCtx.createGain();
      micGain.gain.value = 1.0;
      micSource.connect(micGain);
      micGain.connect(dest);

      // -----------------------------------------------------------------------
      // 5. Handle device disconnects
      // -----------------------------------------------------------------------
      if (systemStream) {
        for (const track of systemStream.getAudioTracks()) {
          track.onended = () => {
            console.warn("[meeting-recorder] System audio track ended unexpectedly");
            void stopRecording();
          };
        }
      }

      for (const track of micStream.getAudioTracks()) {
        track.onended = () => {
          console.warn("[meeting-recorder] Mic track ended — attempting recovery");
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((newMic) => {
              stopStream(micStreamRef.current);
              micStreamRef.current = newMic;
              const newMicSource = audioCtx.createMediaStreamSource(newMic);
              const newMicGain = audioCtx.createGain();
              newMicGain.gain.value = 1.0;
              newMicSource.connect(newMicGain);
              newMicGain.connect(dest);
            })
            .catch(() => {
              console.error("[meeting-recorder] Mic recovery failed — stopping");
              void stopRecording();
            });
        };
      }

      // -----------------------------------------------------------------------
      // 6. Create MediaRecorder and stream audio over WebSocket
      // -----------------------------------------------------------------------
      const mimeType = pickMimeType();
      rlog(`[meeting-recorder] ${micOnly ? "Mic-only" : "Mixed"} stream — mimeType=${mimeType}`);
      setIsMicOnly(micOnly);

      const recorder = new MediaRecorder(dest.stream, { mimeType });
      recorderRef.current = recorder;

      recorder.onerror = (e) => {
        console.error("[meeting-recorder] MediaRecorder error:", e);
      };

      // Stream each chunk as binary over the WebSocket
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size === 0 || stoppedRef.current) return;
        const currentWs = wsRef.current;
        if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return;

        // Convert Blob to ArrayBuffer and send as binary frame
        void event.data.arrayBuffer().then((buffer) => {
          if (stoppedRef.current) return;
          if (currentWs.readyState === WebSocket.OPEN) {
            currentWs.send(buffer);
          }
        });
      };

      // Use small timeslice for low-latency streaming
      recorder.start(MEDIA_RECORDER_TIMESLICE_MS);

      // -----------------------------------------------------------------------
      // 7. Start elapsed timer + update state
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
    rlog("[meeting-recorder] stopRecording() called");
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
        const timeout = setTimeout(resolve, 2000);
        closeResolveRef.current = () => { clearTimeout(timeout); resolve(); };
      });
      closeResolveRef.current = null;
    }

    // Assemble final transcript
    const transcript = transcriptPartsRef.current.join(" ");
    rlog(`[meeting-recorder] Final transcript: ${transcript.length} chars, ${transcriptPartsRef.current.length} parts`);
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
