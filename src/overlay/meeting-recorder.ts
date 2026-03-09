/**
 * Meeting Recorder — dual-stream audio capture (system audio + mic)
 * Streams raw PCM (linear16 16kHz) via WebSocket to /ws/transcribe
 * (Deepgram proxy with diarize=true) for real-time transcription with speaker diarization.
 */

import { useRef, useCallback, useEffect } from "react";
import {
  SYSTEM_AUDIO_GAIN,
  MIC_AUDIO_GAIN,
  PCM_SAMPLE_RATE,
  PCM_BUFFER_SIZE,
  WS_CONNECT_TIMEOUT_MS,
  WS_CLOSE_ACK_TIMEOUT_MS,
} from "@/shared-overlay/constants";

/** Log to both overlay console AND main process stdout */
const mlog = (...args: unknown[]): void => {
  const msg = args
    .map((a) => (typeof a === "string" ? a : String(a)))
    .join(" ");
  console.warn(msg);
  window.electronAPI?.logToMain?.(msg);
};

export type TranscriptSegment = {
  speaker: number | undefined;
  text: string;
  isFinal: boolean;
  speechFinal: boolean;
};

export type MeetingRecorderActions = {
  startRecording: (meetingId: string) => Promise<{ micOnly: boolean }>;
  stopRecording: () => Promise<{
    meetingId: string | null;
    transcript: string;
    segments: TranscriptSegment[];
  }>;
};

/** Convert Float32 samples (-1..1) to Int16 PCM bytes */
const float32ToInt16 = (float32: Float32Array): Int16Array => {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]!));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
};

const stopStream = (stream: MediaStream | null): void => {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
};

type WsTranscriptMsg = {
  type: "transcript" | "ready" | "error" | "closed" | "reconnecting";
  transcript?: string;
  is_final?: boolean;
  speech_final?: boolean;
  speaker?: number;
  message?: string;
  attempt?: number;
};

export const useMeetingRecorder = (
  _chunkIntervalMs?: number,
  onError?: (message: string) => void,
): MeetingRecorderActions => {
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const meetingIdRef = useRef<string | null>(null);
  const stoppedRef = useRef<boolean>(true);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const micOnlyRef = useRef<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  // Track latest partial transcript per speaker for assembling final text
  const finalSegmentsRef = useRef<
    Array<{ speaker: number | undefined; text: string; timestamp: number }>
  >([]);

  const cleanup = useCallback((): void => {
    if (scriptNodeRef.current) {
      scriptNodeRef.current.disconnect();
      scriptNodeRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    stopStream(systemStreamRef.current);
    systemStreamRef.current = null;
    stopStream(micStreamRef.current);
    micStreamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    meetingIdRef.current = null;
    segmentsRef.current = [];
    finalSegmentsRef.current = [];
    stoppedRef.current = true;
  }, []);

  const getSystemAudioStream = async (): Promise<MediaStream> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new Error(
              "System audio capture timed out — Screen Recording permission may be denied",
            ),
          ),
        5000,
      );
    });

    const streamPromise = navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: {
        width: 4,
        height: 4,
        frameRate: 1,
      } as MediaTrackConstraints,
    });

    try {
      const stream = await Promise.race([streamPromise, timeoutPromise]);
      clearTimeout(timeoutId!);

      for (const videoTrack of stream.getVideoTracks()) {
        videoTrack.stop();
        stream.removeTrack(videoTrack);
      }

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No audio tracks in display media stream");
      }

      if (audioTracks[0]!.readyState === "ended") {
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

  /** Open WebSocket to /ws/transcribe on the local server */
  const openTranscriptionWs = async (): Promise<WebSocket> => {
    // Get API URL and session token from main process
    const apiUrl =
      (await window.electronAPI?.getApiUrl?.()) ?? "http://localhost:3001";
    const token =
      (await window.electronAPI?.getSessionToken?.()) ?? "";

    if (!token) {
      throw new Error("No session token available for WebSocket auth");
    }

    // Convert http(s) to ws(s)
    const wsBase = apiUrl.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/ws/transcribe?token=${encodeURIComponent(token)}&encoding=linear16&sample_rate=${PCM_SAMPLE_RATE}&channels=1`;
    mlog("[meeting-recorder] Opening WebSocket to", wsBase + "/ws/transcribe (linear16)");

    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("WebSocket connection timed out"));
      }, WS_CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        mlog("[meeting-recorder] WebSocket connected, waiting for ready...");
      };

      const onFirstMessage = (event: MessageEvent): void => {
        try {
          const msg = JSON.parse(
            typeof event.data === "string"
              ? event.data
              : new TextDecoder().decode(event.data as ArrayBuffer),
          ) as WsTranscriptMsg;

          if (msg.type === "ready") {
            clearTimeout(timeout);
            ws.removeEventListener("message", onFirstMessage);
            mlog("[meeting-recorder] WebSocket ready (Deepgram connected)");
            resolve(ws);
          } else if (msg.type === "error") {
            clearTimeout(timeout);
            ws.removeEventListener("message", onFirstMessage);
            ws.close();
            reject(new Error(msg.message ?? "WebSocket error"));
          }
        } catch {
          /* wait for valid JSON */
        }
      };

      ws.addEventListener("message", onFirstMessage);

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("WebSocket connection failed"));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        // Only reject if we haven't resolved yet
      };
    });
  };

  const startRecording = useCallback(
    async (meetingId: string): Promise<{ micOnly: boolean }> => {
      mlog(
        "[meeting-recorder] startRecording called, meetingId=",
        meetingId,
        "hasExistingScriptNode=",
        !!scriptNodeRef.current,
      );
      if (scriptNodeRef.current) {
        mlog("[meeting-recorder] Already recording, returning early");
        return { micOnly: false };
      }

      meetingIdRef.current = meetingId;
      stoppedRef.current = false;
      segmentsRef.current = [];
      finalSegmentsRef.current = [];

      // 1. Open WebSocket to transcription proxy
      let ws: WebSocket;
      try {
        ws = await openTranscriptionWs();
      } catch (err) {
        mlog(
          "[meeting-recorder] WebSocket failed:",
          err instanceof Error ? err.message : err,
        );
        throw err;
      }
      wsRef.current = ws;

      // 2. Listen for transcript messages
      ws.onmessage = (event: MessageEvent) => {
        if (stoppedRef.current) return;
        try {
          const data =
            typeof event.data === "string"
              ? event.data
              : new TextDecoder().decode(event.data as ArrayBuffer);
          const msg = JSON.parse(data) as WsTranscriptMsg;

          if (msg.type === "transcript" && msg.transcript) {
            const seg: TranscriptSegment = {
              speaker: msg.speaker,
              text: msg.transcript,
              isFinal: msg.is_final ?? false,
              speechFinal: msg.speech_final ?? false,
            };
            segmentsRef.current.push(seg);

            // Accumulate final segments for the assembled transcript
            if (msg.speech_final || msg.is_final) {
              finalSegmentsRef.current.push({
                speaker: msg.speaker,
                text: msg.transcript,
                timestamp: Date.now(),
              });
              mlog(
                `[meeting-recorder] FINAL #${finalSegmentsRef.current.length} [Speaker ${msg.speaker ?? "?"}] is_final=${msg.is_final} speech_final=${msg.speech_final} "${msg.transcript.slice(0, 80)}"`,
              );
            } else {
              mlog(
                `[meeting-recorder] partial [Speaker ${msg.speaker ?? "?"}] "${msg.transcript.slice(0, 60)}"`,
              );
            }
          } else if (msg.type === "error") {
            mlog("[meeting-recorder] WS error:", msg.message);
          } else if (msg.type === "reconnecting") {
            mlog(
              "[meeting-recorder] Deepgram reconnecting, attempt=",
              msg.attempt,
            );
          } else if (msg.type === "closed") {
            mlog("[meeting-recorder] Deepgram stream closed");
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.onclose = (event: CloseEvent) => {
        mlog(`[meeting-recorder] WebSocket closed, code=${event.code} reason="${event.reason}" wasClean=${event.wasClean} stopped=${stoppedRef.current} finalSegments=${finalSegmentsRef.current.length} allSegments=${segmentsRef.current.length}`);
        wsRef.current = null;
      };

      ws.onerror = (event) => {
        mlog("[meeting-recorder] WebSocket error:", event);
      };

      // 3. Audio capture setup
      let systemStream: MediaStream | null = null;
      let micOnly = false;

      try {
        mlog("[meeting-recorder] Attempting system audio capture...");
        systemStream = await getSystemAudioStream();
        systemStreamRef.current = systemStream;
        mlog(
          "[meeting-recorder] System audio captured successfully, tracks=",
          systemStream.getAudioTracks().length,
        );
      } catch (sysErr) {
        mlog(
          "[meeting-recorder] System audio failed:",
          sysErr instanceof Error ? sysErr.message : sysErr,
        );
        micOnly = true;
        // Fallback to ScreenCaptureKit via main process
        try {
          const started =
            await window.electronAPI?.startSystemAudio?.(meetingId);
          if (started) {
            mlog("[meeting-recorder] ScreenCaptureKit fallback started");
          } else {
            mlog(
              "[meeting-recorder] ScreenCaptureKit fallback failed or unavailable",
            );
          }
        } catch {
          /* ScreenCaptureKit not available */
        }
      }

      micOnlyRef.current = micOnly;

      mlog("[meeting-recorder] Requesting mic access...");
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      mlog(
        "[meeting-recorder] Mic access granted, tracks=",
        micStream.getAudioTracks().length,
      );
      micStreamRef.current = micStream;

      let audioCtx: AudioContext;
      try {
        audioCtx = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
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
      mlog("[meeting-recorder] AudioContext created, sampleRate=", audioCtx.sampleRate);

      // Create ScriptProcessorNode for raw PCM capture
      const scriptNode = audioCtx.createScriptProcessor(PCM_BUFFER_SIZE, 1, 1);
      scriptNodeRef.current = scriptNode;

      if (systemStream) {
        const systemSource = audioCtx.createMediaStreamSource(systemStream);
        const systemGain = audioCtx.createGain();
        systemGain.gain.value = SYSTEM_AUDIO_GAIN;
        systemSource.connect(systemGain);
        systemGain.connect(scriptNode);
        mlog("[meeting-recorder] System audio connected to mixer (gain=", SYSTEM_AUDIO_GAIN, ")");
      }

      const micSource = audioCtx.createMediaStreamSource(micStream);
      const micGain = audioCtx.createGain();
      micGain.gain.value = MIC_AUDIO_GAIN;
      micSource.connect(micGain);
      micGain.connect(scriptNode);
      micSourceRef.current = micSource;
      micGainRef.current = micGain;
      mlog("[meeting-recorder] Mic connected to mixer (gain=", MIC_AUDIO_GAIN, ")");

      // 4. Stream raw PCM via WebSocket
      let audioChunksSent = 0;
      scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
        if (stoppedRef.current) return;
        const inputData = event.inputBuffer.getChannelData(0);
        const int16 = float32ToInt16(inputData);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(int16.buffer);
          audioChunksSent++;
          if (audioChunksSent <= 3 || audioChunksSent % 200 === 0) {
            mlog(`[meeting-recorder] Audio chunk #${audioChunksSent} sent, size=${int16.buffer.byteLength}, wsState=${wsRef.current.readyState}`);
          }
        } else if (audioChunksSent > 0 && audioChunksSent % 200 === 1) {
          mlog(`[meeting-recorder] WARNING: WS not open, readyState=${wsRef.current?.readyState ?? "null"}, dropping audio chunk #${audioChunksSent}`);
        }
      };

      // ScriptProcessorNode must connect to destination to fire onaudioprocess.
      // Use a mute gain node to prevent feedback.
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0;
      scriptNode.connect(muteGain);
      muteGain.connect(audioCtx.destination);

      // Mic recovery
      for (const track of micStream.getAudioTracks()) {
        track.onended = () => {
          navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((newMic) => {
              micSourceRef.current?.disconnect();
              micGainRef.current?.disconnect();
              stopStream(micStreamRef.current);
              micStreamRef.current = newMic;
              const newMicSource = audioCtx.createMediaStreamSource(newMic);
              const newMicGain = audioCtx.createGain();
              newMicGain.gain.value = MIC_AUDIO_GAIN;
              newMicSource.connect(newMicGain);
              newMicGain.connect(scriptNode);
              micSourceRef.current = newMicSource;
              micGainRef.current = newMicGain;
              mlog("[meeting-recorder] Mic recovered after disconnect");
            })
            .catch(() => {
              mlog("[meeting-recorder] Mic recovery failed, stopping");
              void stopRecording();
            });
        };
      }

      mlog(
        "[meeting-recorder] ScriptProcessorNode started, bufferSize=",
        PCM_BUFFER_SIZE,
        "sampleRate=",
        PCM_SAMPLE_RATE,
        "mode=",
        micOnly ? "mic-only" : "mic+system",
      );

      return { micOnly };
    },
    // stopRecording is stored in ref and called from mic recovery; listing it would require defining it before startRecording
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const stopRecording = useCallback(async (): Promise<{
    meetingId: string | null;
    transcript: string;
    segments: TranscriptSegment[];
  }> => {
    mlog(
      "[meeting-recorder] stopRecording called, meetingId=",
      meetingIdRef.current,
    );
    stoppedRef.current = true;
    const mid = meetingIdRef.current;

    // Disconnect ScriptProcessorNode
    if (scriptNodeRef.current) {
      scriptNodeRef.current.onaudioprocess = null;
      scriptNodeRef.current.disconnect();
      scriptNodeRef.current = null;
    }

    // Send CloseStream and wait for Deepgram to finish
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      mlog("[meeting-recorder] Sending CloseStream...");
      ws.send(JSON.stringify({ type: "CloseStream" }));

      // Wait for closed acknowledgement
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          mlog("[meeting-recorder] CloseStream ack timed out");
          resolve();
        }, WS_CLOSE_ACK_TIMEOUT_MS);

        const onMsg = (event: MessageEvent): void => {
          try {
            const data =
              typeof event.data === "string"
                ? event.data
                : new TextDecoder().decode(event.data as ArrayBuffer);
            const msg = JSON.parse(data) as WsTranscriptMsg;

            // Still capture final transcripts
            if (msg.type === "transcript" && msg.transcript) {
              if (msg.speech_final || msg.is_final) {
                finalSegmentsRef.current.push({
                  speaker: msg.speaker,
                  text: msg.transcript,
                  timestamp: Date.now(),
                });
              }
            }

            if (msg.type === "closed") {
              clearTimeout(timeout);
              ws.removeEventListener("message", onMsg);
              mlog("[meeting-recorder] CloseStream ack received");
              resolve();
            }
          } catch {
            /* ignore */
          }
        };
        ws.addEventListener("message", onMsg);
      });

      ws.close();
      wsRef.current = null;
    }

    // Stop ScreenCaptureKit if fallback was used
    let systemSegments: Array<{ speaker: string; text: string; timestamp: number }> = [];
    if (micOnlyRef.current) {
      try {
        systemSegments =
          (await window.electronAPI?.stopSystemAudio?.()) ?? [];
      } catch {
        /* wasn't running */
      }
    }

    // Merge mic and system audio segments chronologically
    const micSegs = finalSegmentsRef.current.map((seg) => ({
      speaker: seg.speaker !== undefined ? `Speaker ${seg.speaker}` : "Unknown",
      text: seg.text,
      timestamp: seg.timestamp,
    }));

    const allSegs = [...micSegs, ...systemSegments].sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    const lines: string[] = allSegs.map(
      (seg) => `${seg.speaker}: ${seg.text}`,
    );
    const transcript = lines.join("\n");
    const segments = [...segmentsRef.current];
    mlog(
      "[meeting-recorder] Final transcript:",
      allSegs.length,
      "segments (mic:",
      micSegs.length,
      "+ system:",
      systemSegments.length,
      "),",
      transcript.length,
      "chars",
    );

    // Cleanup
    stopStream(systemStreamRef.current);
    systemStreamRef.current = null;
    stopStream(micStreamRef.current);
    micStreamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    meetingIdRef.current = null;
    segmentsRef.current = [];
    finalSegmentsRef.current = [];

    return { meetingId: mid, transcript, segments };
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { startRecording, stopRecording };
};
