import { useEffect, useCallback, useRef, useState, useReducer } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { OverlaySettings, NotchInfo } from "@/shared-overlay/types";
import { FLASH_SHORT_MS, FLASH_LONG_MS } from "@/shared-overlay/constants";
import { setIgnoreMouse } from "./lib/ipc";
import { cancel as cancelTTS } from "./lib/tts";
import {
  useSpeechRecognition,
  type SpeechRecognitionState,
} from "./lib/whisper";
import {
  pillReducer,
  initialPillContext,
  type InteractionMode,
} from "./lib/notch-pill-state";
import { useMeetingRecorder } from "./meeting-recorder";
import { useFlashMessage } from "./lib/use-flash-message";
import { useAIResponse } from "./lib/use-ai-response";
import { useActivationHandler } from "./lib/use-activation-handler";
import { useMeetingControls } from "./lib/use-meeting-controls";
import {
  ACTIVE_HEIGHT,
  CONTENT_ENTER,
  CONTENT_EXIT,
  SPRING,
  STAGGER_MS,
} from "./lib/pill-constants";
import {
  Sparkle,
  PencilIcon,
  MicIcon,
  CompanyLogo,
  Waveform,
  ThinkingDots,
  ResponseBody,
  MeetingTimer,
} from "./lib/pill-components";

const DEFAULT_SETTINGS: OverlaySettings = {
  shortcuts: {
    assistantToggle: "CommandOrControl+Space",
    dictationToggle: "CommandOrControl+Shift+Space",
    dictationHoldKey: "CommandOrControl+Shift+Space",
    meetingToggle: "CommandOrControl+Alt+Space",
  },
  voice: {
    language: "en-US",
    silenceTimeoutMs: 3000,
    ttsEnabled: false,
    ttsRate: 1.05,
    audioInputDeviceId: null,
  },
  behavior: {
    doubleTapWindowMs: 400,
    autoDismissMs: 5000,
    showDictationPreview: true,
    holdThresholdMs: 150,
  },
  meeting: { autoDetect: false, chunkIntervalMs: 5000 },
};

export const OverlayApp = () => {
  const [config, setConfig] = useState<NotchInfo | null>(null);
  const [pill, dispatch] = useReducer(pillReducer, initialPillContext);
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_SETTINGS);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [showLastResponse, setShowLastResponse] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamAbortRef = useRef(false);

  const flash = useFlashMessage();
  const handleRecorderError = useCallback(
    (msg: string) => flash.show(msg, 3000),
    [flash],
  );
  const meetingRecorder = useMeetingRecorder(
    settings.meeting?.chunkIntervalMs ?? 5000,
    handleRecorderError,
  );
  const meetingRecorderRef = useRef(meetingRecorder);
  meetingRecorderRef.current = meetingRecorder;

  const pillRef = useRef(pill);
  pillRef.current = pill;
  const speechRef = useRef<SpeechRecognitionState | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismissRef = useRef(() => {});
  dismissRef.current = () => {
    cancelTTS();
    clearDismissTimer();
    streamAbortRef.current = true;
    const s = speechRef.current;
    if (s?.isListening) {
      void s.stopListening();
    }
    dispatch({ type: "DISMISS" });
    window.electronAPI?.notifyDismissed?.();
  };

  const dismiss = useCallback(() => dismissRef.current(), []);

  const activation = useActivationHandler({
    dispatch,
    pillRef,
    speechRef,
    dismissRef,
    showFlash: flash.show,
  });

  const meeting = useMeetingControls({
    dispatch,
    pillRef,
    meetingRecorderRef,
    showFlash: flash.show,
  });

  useAIResponse(
    pill.state,
    pill.transcript,
    pill.conversationHistory,
    dispatch,
    streamAbortRef,
  );

  const handleSilence = useCallback(() => {
    const p = pillRef.current;
    const s = speechRef.current;
    if (p.interactionMode !== "assistant" || p.state !== "listening" || !s)
      return;
    dispatch({ type: "TRANSCRIBING_START" });
    s.stopListening()
      .then((transcript) => {
        if (transcript) {
          dispatch({ type: "LISTENING_COMPLETE", transcript });
        } else {
          dismissRef.current();
        }
      })
      .catch(() => {
        dismissRef.current();
      });
  }, []);

  const speech = useSpeechRecognition({
    onSilence: handleSilence,
    silenceTimeoutMs: settings.voice.silenceTimeoutMs,
    preferredDeviceId: settings.voice.audioInputDeviceId ?? undefined,
    onMicError: (msg) =>
      flash.show(
        msg.includes("denied") || msg.includes("Permission")
          ? "Microphone access denied — check app permissions"
          : msg,
        FLASH_LONG_MS,
      ),
    onTranscriptionError: (msg) => flash.show(msg, FLASH_LONG_MS),
  });
  speechRef.current = speech;

  useEffect(() => {
    clearDismissTimer();
    if (pill.state === "response") {
      dismissTimerRef.current = setTimeout(
        dismiss,
        settings.behavior.autoDismissMs,
      );
    }
    if (pill.state !== "idle") {
      setShowLastResponse(false);
    }
    return clearDismissTimer;
  }, [pill.state, settings.behavior.autoDismissMs, dismiss, clearDismissTimer]);

  // TTS disabled

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.removeAllListeners?.();
    api
      .getOverlaySettings?.()
      .then((s) => setSettings(s))
      .catch(() => {});
    api.onNotchInfo?.((info: NotchInfo) => setConfig(info));
    api.onSettingsChanged?.((s: OverlaySettings) => setSettings(s));

    api.onActivate?.(activation.handleActivate);
    api.onDeactivate?.(activation.handleDeactivate);
    api.onHoldStart?.(activation.handleHoldStart);
    api.onHoldEnd?.(activation.handleHoldEnd);

    api.onMeetingToggle?.(meeting.handleMeetingToggle);
    api.onMeetingStarted?.(meeting.handleMeetingStarted);
    api.onMeetingStopped?.(meeting.handleMeetingStopped);
    api.onSystemAudioTranscript?.(meeting.handleSystemAudioTranscript);

    meeting.restoreMeetingState();
    meeting.restorePersistedMeeting();

    return () => {
      api.removeAllListeners?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Mount-only: register listeners once; handlers use refs for current state
  }, []);

  useEffect(() => {
    if (pill.state === "idle") {
      cancelTTS();
      window.electronAPI?.notifyDismissed?.();
    }
  }, [pill.state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pillRef.current.state !== "idle") {
        e.preventDefault();
        dismissRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Measure response content height using ResizeObserver for reliable layout measurement
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (h > 0) setMeasuredHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasNotch = config?.hasNotch ?? false;
  const notchHeight = config?.notchHeight ?? 0;
  const menuBarHeight = config?.menuBarHeight ?? 25;
  const windowWidth = config?.windowWidth ?? 400;
  const topPad = hasNotch ? notchHeight + 2 : 3;

  // Cap response body height at ~1/3 screen
  const screenH = window.screen?.height ?? 900;
  const maxResponseBodyHeight = Math.round(screenH * 0.33) - 80;

  // Response layout: title(24) + bodyGap(8) + body(responseContentH) + doneGap(6) + done(~14) + bottomPad(12)
  const RESPONSE_EXTRA_H = 24 + 8 + 6 + 14 + 12;

  let pillHeight: number;
  const responseContentH = Math.min(
    Math.max(measuredHeight, 40), // at least 40px while measuring
    maxResponseBodyHeight,
  );
  if (pill.state === "idle" && showLastResponse) {
    pillHeight = topPad + RESPONSE_EXTRA_H + responseContentH;
  } else if (pill.state === "idle") {
    pillHeight = menuBarHeight;
  } else if (pill.state === "response") {
    pillHeight = topPad + RESPONSE_EXTRA_H + responseContentH;
  } else {
    pillHeight = topPad + ACTIVE_HEIGHT;
  }

  // Dynamic resize via IPC — keep Electron window in sync with pill height
  useEffect(() => {
    window.electronAPI?.resizeOverlay?.(pillHeight);
  }, [pillHeight]);

  const currentResponse = {
    title: pill.responseTitle,
    lines: pill.responseLines,
  };

  const modeIcon = () => {
    switch (pill.interactionMode) {
      case "dictation":
        return <PencilIcon />;
      case "transcribe":
        return <MicIcon />;
      default:
        return <Sparkle active />;
    }
  };

  const modeLabel = () => {
    switch (pill.interactionMode) {
      case "assistant":
        return "Listening...";
      case "continuous":
        return "Listening (continuous)...";
      case "dictation":
        return "Dictating...";
      case "transcribe":
        return "Transcribing...";
    }
  };

  const modeDetail = (): string | null => {
    if (pill.interactionMode === "continuous" && speech.transcript) {
      const words = speech.transcript.split(/\s+/).length;
      return `${words} word${words === 1 ? "" : "s"}`;
    }
    if (
      (pill.interactionMode === "dictation" ||
        pill.interactionMode === "transcribe" ||
        pill.interactionMode === "assistant") &&
      speech.interimText
    ) {
      return speech.interimText;
    }
    return null;
  };

  const handleMouseEnter = useCallback(() => {
    setIgnoreMouse(false);
    // Pause dismiss timer when hovering over response
    if (pillRef.current.state === "response") {
      clearDismissTimer();
    }
    // Show last response on hover when idle
    if (pillRef.current.state === "idle" && pillRef.current.lastResponseTitle) {
      setShowLastResponse(true);
    }
  }, [clearDismissTimer]);

  const handleMouseLeave = useCallback(() => {
    setIgnoreMouse(true);
    setShowLastResponse(false);
    // Restart dismiss timer if still in response state
    if (pillRef.current.state === "response") {
      clearDismissTimer();
      dismissTimerRef.current = setTimeout(
        () => dismissRef.current(),
        settingsRef.current.behavior.autoDismissMs,
      );
    }
  }, [clearDismissTimer]);

  const handlePillClick = useCallback(() => {
    const cur = pillRef.current;
    const s = speechRef.current;
    if (cur.state === "idle") {
      if (!s) return;
      dispatch({ type: "ACTIVATE", mode: "dictation" as InteractionMode });
      s.startListening();
    } else if (
      cur.state === "listening" &&
      cur.interactionMode === "dictation"
    ) {
      if (!s) return;
      dispatch({ type: "TRANSCRIBING_START" });
      s.stopListening().then((transcript) => {
        if (transcript) {
          window.electronAPI
            ?.injectText?.(transcript)
            .then(() => {
              dispatch({ type: "TRANSCRIBING_COMPLETE", transcript });
              flash.show("Copied! ⌘V to paste", FLASH_SHORT_MS);
              setTimeout(() => dismissRef.current(), FLASH_SHORT_MS);
            })
            .catch(() => dismissRef.current());
        } else {
          dismissRef.current();
        }
      });
    } else {
      dismissRef.current();
    }
  }, [flash]);

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          width: windowWidth - 32,
          paddingLeft: 22,
        }}
      >
        {pill.state === "response" && (
          <ResponseBody response={currentResponse} />
        )}
        {showLastResponse && pill.state === "idle" && (
          <ResponseBody
            response={{
              title: pill.lastResponseTitle,
              lines: pill.lastResponseLines,
            }}
          />
        )}
      </div>

      <motion.div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handlePillClick}
        animate={{ height: pillHeight }}
        transition={SPRING}
        style={{
          width: "100%",
          background: "#000",
          borderRadius: pill.state === "idle" ? "0 0 8px 8px" : "0 0 16px 16px",
          overflow: "hidden",
          position: "relative",
          cursor:
            pill.state === "idle" && !showLastResponse ? "pointer" : "default",
        }}
      >
        <div
          style={{
            paddingTop: pill.state === "idle" ? 0 : topPad,
            paddingLeft: 16,
            paddingRight: 16,
            paddingBottom: pill.state === "idle" ? 0 : 12,
          }}
        >
          {pill.state === "idle" && !flash.message && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                height: menuBarHeight,
                gap: 6,
              }}
            >
              <CompanyLogo />
              {pill.meetingActive && (
                <>
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#ef4444",
                      flexShrink: 0,
                    }}
                  />
                  <MeetingTimer startedAt={pill.meetingStartedAt} />
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void window.electronAPI?.hideOverlay?.();
                }}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  padding: "2px 3px",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 11,
                  lineHeight: 1,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 3,
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "rgba(255,255,255,1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "rgba(255,255,255,0.6)";
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          )}

          {pill.state === "idle" && flash.message && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                height: menuBarHeight,
              }}
            >
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  color: "#4ade80",
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                {flash.message}
              </motion.span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {pill.state === "listening" && (
              <motion.div
                key="listening"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={CONTENT_ENTER}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 24,
                  gap: 8,
                }}
              >
                {modeIcon()}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      color: "#fff",
                      fontSize: 13.5,
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {modeLabel()}
                  </span>
                  {modeDetail() && (
                    <span
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 11,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {modeDetail()}
                    </span>
                  )}
                </div>
                <Waveform level={speech.audioLevel} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss();
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "2px 3px",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    lineHeight: 1,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 3,
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "rgba(255,255,255,1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "rgba(255,255,255,0.6)";
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </motion.div>
            )}

            {pill.state === "thinking" && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={CONTENT_ENTER}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 24,
                  gap: 8,
                }}
              >
                <Sparkle active />
                {pill.streamingText ? (
                  <span
                    style={{
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 12.5,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pill.streamingText.slice(-80)}
                  </span>
                ) : (
                  <ThinkingDots />
                )}
              </motion.div>
            )}

            {pill.state === "transcribing" && (
              <motion.div
                key="transcribing"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={CONTENT_ENTER}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 24,
                  gap: 8,
                }}
              >
                <ThinkingDots />
                <span
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 13.5,
                    fontWeight: 500,
                  }}
                >
                  Transcribing...
                </span>
              </motion.div>
            )}

            {pill.state === "response" && (
              <motion.div
                key={`response-${pill.responseTitle}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={CONTENT_EXIT}
              >
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...CONTENT_ENTER, delay: 0 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: 24,
                    gap: 8,
                  }}
                >
                  <Sparkle active />
                  <span
                    style={{
                      color: "#fff",
                      fontSize: 13.5,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {currentResponse.title}
                  </span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...CONTENT_ENTER,
                    delay: STAGGER_MS / 1000,
                  }}
                  style={{
                    marginTop: 8,
                    paddingLeft: 22,
                    maxHeight: maxResponseBodyHeight,
                    overflowY: "auto",
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.15) transparent",
                  }}
                >
                  <ResponseBody response={currentResponse} />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.35 }}
                  transition={{
                    ...CONTENT_ENTER,
                    delay: (STAGGER_MS * 2) / 1000,
                  }}
                  style={{
                    textAlign: "right",
                    marginTop: 6,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  Done
                </motion.div>
              </motion.div>
            )}

            {showLastResponse &&
              pill.state === "idle" &&
              pill.lastResponseTitle && (
                <motion.div
                  key="last-response"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 0.7, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      height: 24,
                      gap: 8,
                    }}
                  >
                    <Sparkle active={false} />
                    <span
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        fontSize: 13.5,
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {pill.lastResponseTitle}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      paddingLeft: 22,
                      maxHeight: maxResponseBodyHeight,
                      overflowY: "auto",
                      scrollbarWidth: "thin",
                      scrollbarColor: "rgba(255,255,255,0.15) transparent",
                    }}
                  >
                    <ResponseBody
                      response={{
                        title: pill.lastResponseTitle,
                        lines: pill.lastResponseLines,
                      }}
                    />
                  </div>
                </motion.div>
              )}
          </AnimatePresence>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "50%",
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          }}
        />
      </motion.div>
    </div>
  );
};
