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
  /** AbortController for cancelling in-progress setup on rapid stop */
  const setupAbortRef = useRef<AbortController | null>(null);
  /** Serializes start/stop to prevent concurrent setup races */
  const _setupLockRef = useRef<Promise<unknown>>(Promise.resolve());
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
    mlog(`[MEETING:REC:HN] ws connecting url=${wsBase}/ws/transcribe encoding=linear16 sampleRate=${PCM_SAMPLE_RATE} t=${Date.now()}`);

    const wsConnectStart = Date.now();
    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      const timeout = setTimeout(() => {
        const elapsed = Date.now() - wsConnectStart;
        mlog(`[MEETING:REC:HN] ws connection TIMEOUT elapsed=${elapsed}ms limit=${WS_CONNECT_TIMEOUT_MS}ms t=${Date.now()}`);
        ws.close();
        reject(new Error("WebSocket connection timed out"));
      }, WS_CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        const elapsed = Date.now() - wsConnectStart;
        mlog(`[MEETING:REC:HN] ws onopen elapsed=${elapsed}ms t=${Date.now()}`);
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
            const elapsed = Date.now() - wsConnectStart;
            mlog(`[MEETING:REC:HN] ws ready (Deepgram connected) elapsed=${elapsed}ms t=${Date.now()}`);
            resolve(ws);
          } else if (msg.type === "error") {
            clearTimeout(timeout);
            ws.removeEventListener("message", onFirstMessage);
            mlog(`[MEETING:REC:HN] ws error during handshake msg=${msg.message ?? "unknown"} t=${Date.now()}`);
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
        mlog(`[MEETING:REC:HN] ws onerror during connect elapsed=${Date.now() - wsConnectStart}ms t=${Date.now()}`);
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
        `[MEETING:REC:HN] startRecording entry meetingId=${meetingId} alreadyRecording=${!!scriptNodeRef.current} stoppedRef=${stoppedRef.current} hasWs=${!!wsRef.current} t=${Date.now()}`,
      );
      if (scriptNodeRef.current) {
        mlog(`[MEETING:REC:HN] startRecording BAIL — already recording meetingId=${meetingId} t=${Date.now()}`);
        return { micOnly: false };
      }

      // Abort any previous in-progress setup
      setupAbortRef.current?.abort();
      const abortController = new AbortController();
      setupAbortRef.current = abortController;
      const signal = abortController.signal;

      meetingIdRef.current = meetingId;
      stoppedRef.current = false;
      segmentsRef.current = [];
      finalSegmentsRef.current = [];

      /** Check abort after each async step; cleans up acquired resources */
      const checkAbort = (label: string): void => {
        if (signal.aborted) {
          mlog(`[MEETING:REC:HN] startRecording ABORT at ${label} — stopped during setup t=${Date.now()}`);
          cleanup();
          throw new DOMException(`Setup cancelled at ${label}`, "AbortError");
        }
      };

      try {
        // 1. Open WebSocket to transcription proxy
        const ws = await openTranscriptionWs();
        wsRef.current = ws;
        checkAbort("after-ws-open");

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

              if (msg.speech_final || msg.is_final) {
                finalSegmentsRef.current.push({
                  speaker: msg.speaker,
                  text: msg.transcript,
                  timestamp: Date.now(),
                });
                mlog(
                  `[MEETING:REC:HN] segment FINAL #${finalSegmentsRef.current.length} speaker=${msg.speaker ?? "?"} is_final=${msg.is_final} speech_final=${msg.speech_final} textLen=${msg.transcript.length} text="${msg.transcript.slice(0, 80)}" t=${Date.now()}`,
                );
                if (finalSegmentsRef.current.length % 10 === 0) {
                  mlog(
                    `[MEETING:REC:HN] segment milestone finalCount=${finalSegmentsRef.current.length} totalSegments=${segmentsRef.current.length} t=${Date.now()}`,
                  );
                }
              }
            } else if (msg.type === "error") {
              mlog(`[MEETING:REC:HN] ws transcript error msg=${msg.message} t=${Date.now()}`);
            } else if (msg.type === "reconnecting") {
              mlog(`[MEETING:REC:HN] Deepgram reconnecting attempt=${msg.attempt} t=${Date.now()}`);
            } else if (msg.type === "closed") {
              const reason = (msg as { reason?: string }).reason ?? "";
              mlog(`[MEETING:REC:HN] Deepgram stream closed reason=${reason} t=${Date.now()}`);
              if (reason === "max_retries" || reason === "max_total_retries") {
                mlog(`[MEETING:REC:HN] Deepgram exhausted retries — transcription unavailable t=${Date.now()}`);
                onErrorRef.current?.("Transcription connection lost");
              }
            }
          } catch {
            /* ignore parse errors */
          }
        };

        ws.onclose = (event: CloseEvent) => {
          mlog(`[MEETING:REC:HN] ws close during recording code=${event.code} reason="${event.reason}" wasClean=${event.wasClean} stopped=${stoppedRef.current} finalSegments=${finalSegmentsRef.current.length} allSegments=${segmentsRef.current.length} t=${Date.now()}`);
          wsRef.current = null;
        };

        ws.onerror = () => {
          mlog(`[MEETING:REC:HN] ws error during recording stopped=${stoppedRef.current} finalSegments=${finalSegmentsRef.current.length} t=${Date.now()}`);
        };

        // 3. Audio capture setup
        let systemStream: MediaStream | null = null;
        let micOnly = false;

        try {
          mlog(`[MEETING:REC:HN] systemAudio trying path=getDisplayMedia t=${Date.now()}`);
          systemStream = await getSystemAudioStream();
          systemStreamRef.current = systemStream;
          mlog(`[MEETING:REC:HN] systemAudio getDisplayMedia SUCCESS tracks=${systemStream.getAudioTracks().length} t=${Date.now()}`);
        } catch (sysErr) {
          mlog(`[MEETING:REC:HN] systemAudio getDisplayMedia FAILED err=${sysErr instanceof Error ? sysErr.message : sysErr} t=${Date.now()}`);
          micOnly = true;
          try {
            mlog(`[MEETING:REC:HN] systemAudio trying path=ScreenCaptureKit fallback t=${Date.now()}`);
            const started = await window.electronAPI?.startSystemAudio?.(meetingId);
            if (started) {
              mlog(`[MEETING:REC:HN] systemAudio ScreenCaptureKit SUCCESS t=${Date.now()}`);
            } else {
              mlog(`[MEETING:REC:HN] systemAudio ScreenCaptureKit FAILED result=false t=${Date.now()}`);
            }
          } catch (sckErr) {
            mlog(`[MEETING:REC:HN] systemAudio ScreenCaptureKit EXCEPTION err=${sckErr instanceof Error ? sckErr.message : sckErr} t=${Date.now()}`);
          }
        }

        mlog(`[MEETING:REC:HN] systemAudio final audioMode=${micOnly ? "mic-only" : "mic+system"} t=${Date.now()}`);
        micOnlyRef.current = micOnly;
        checkAbort("after-system-audio");

        mlog(`[MEETING:REC:HN] mic requesting access t=${Date.now()}`);
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mlog(`[MEETING:REC:HN] mic access granted tracks=${micStream.getAudioTracks().length} t=${Date.now()}`);
        micStreamRef.current = micStream;
        checkAbort("after-mic-access");

        const audioCtx = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
        audioCtxRef.current = audioCtx;
        mlog(`[MEETING:REC:HN] AudioContext created sampleRate=${audioCtx.sampleRate} state=${audioCtx.state} t=${Date.now()}`);

        const scriptNode = audioCtx.createScriptProcessor(PCM_BUFFER_SIZE, 1, 1);
        scriptNodeRef.current = scriptNode;

        if (systemStream) {
          const systemSource = audioCtx.createMediaStreamSource(systemStream);
          const systemGain = audioCtx.createGain();
          systemGain.gain.value = SYSTEM_AUDIO_GAIN;
          systemSource.connect(systemGain);
          systemGain.connect(scriptNode);
          mlog(`[MEETING:REC:HN] systemAudio connected to mixer gain=${SYSTEM_AUDIO_GAIN} t=${Date.now()}`);
        }

        const micSource = audioCtx.createMediaStreamSource(micStream);
        const micGain = audioCtx.createGain();
        micGain.gain.value = MIC_AUDIO_GAIN;
        micSource.connect(micGain);
        micGain.connect(scriptNode);
        micSourceRef.current = micSource;
        micGainRef.current = micGain;
        mlog(`[MEETING:REC:HN] mic connected to mixer gain=${MIC_AUDIO_GAIN} t=${Date.now()}`);

        // 4. Stream raw PCM via WebSocket
        let audioChunksSent = 0;
        let audioChunksDropped = 0;
        scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
          if (stoppedRef.current) return;
          const inputData = event.inputBuffer.getChannelData(0);
          const int16 = float32ToInt16(inputData);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(int16.buffer);
            audioChunksSent++;
            if (audioChunksSent === 1) {
              mlog(`[MEETING:REC:HN] audio FIRST chunk sent size=${int16.buffer.byteLength} wsState=${wsRef.current.readyState} t=${Date.now()}`);
            } else if (audioChunksSent % 100 === 0) {
              mlog(`[MEETING:REC:HN] audio chunk #${audioChunksSent} sent size=${int16.buffer.byteLength} dropped=${audioChunksDropped} t=${Date.now()}`);
            }
          } else {
            audioChunksDropped++;
            if (audioChunksDropped === 1 || audioChunksDropped % 50 === 0) {
              mlog(`[MEETING:REC:HN] audio DROPPING chunk #${audioChunksSent + audioChunksDropped} wsState=${wsRef.current?.readyState ?? "null"} totalDropped=${audioChunksDropped} totalSent=${audioChunksSent} t=${Date.now()}`);
            }
          }
        };

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
                mlog(`[MEETING:REC:HN] mic recovered after disconnect t=${Date.now()}`);
              })
              .catch(() => {
                mlog(`[MEETING:REC:HN] mic recovery FAILED — stopping recording t=${Date.now()}`);
                void stopRecording();
              });
          };
        }

        mlog(
          `[MEETING:REC:HN] recording STARTED bufferSize=${PCM_BUFFER_SIZE} sampleRate=${PCM_SAMPLE_RATE} mode=${micOnly ? "mic-only" : "mic+system"} meetingId=${meetingId} t=${Date.now()}`,
        );

        return { micOnly };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Setup was cancelled by stopRecording — not an error
          return { micOnly: true };
        }
        mlog(`[MEETING:REC:HN] startRecording FAILED err=${err instanceof Error ? err.message : err} t=${Date.now()}`);
        cleanup();
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cleanup],
  );

  const stopRecording = useCallback(async (): Promise<{
    meetingId: string | null;
    transcript: string;
    segments: TranscriptSegment[];
  }> => {
    const stopT0 = Date.now();
    mlog(
      `[MEETING:REC:HN] stopRecording entry meetingId=${meetingIdRef.current} isRecording=${!!scriptNodeRef.current} hasWs=${!!wsRef.current} wsState=${wsRef.current?.readyState ?? "null"} segmentCount=${finalSegmentsRef.current.length} t=${stopT0}`,
    );
    stoppedRef.current = true;

    // Abort any in-progress setup immediately
    if (setupAbortRef.current) {
      setupAbortRef.current.abort();
      setupAbortRef.current = null;
    }

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
      const closeStreamT0 = Date.now();
      mlog(`[MEETING:REC:HN] sending CloseStream t=${closeStreamT0}`);
      ws.send(JSON.stringify({ type: "CloseStream" }));

      // Wait for closed acknowledgement
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          const elapsed = Date.now() - closeStreamT0;
          mlog(`[MEETING:REC:HN] CloseStream ack TIMEOUT elapsed=${elapsed}ms limit=${WS_CLOSE_ACK_TIMEOUT_MS}ms t=${Date.now()}`);
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
              const elapsed = Date.now() - closeStreamT0;
              mlog(`[MEETING:REC:HN] CloseStream ack received elapsed=${elapsed}ms t=${Date.now()}`);
              resolve();
            }
          } catch {
            /* ignore */
          }
        };
        ws.addEventListener("message", onMsg);
      });

      mlog(`[MEETING:REC:HN] ws.close() called t=${Date.now()}`);
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
      `[MEETING:REC:HN] segment merge micCount=${micSegs.length} systemCount=${systemSegments.length} totalCount=${allSegs.length} t=${Date.now()}`,
    );
    mlog(
      `[MEETING:REC:HN] stopRecording DONE meetingId=${mid} transcriptLen=${transcript.length} totalSegments=${segments.length} elapsed=${Date.now() - stopT0}ms t=${Date.now()}`,
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
