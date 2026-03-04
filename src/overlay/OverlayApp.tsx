import { useEffect, useCallback, useRef, useState, useReducer, type MouseEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { XIcon } from "@phosphor-icons/react";
import type {
  OverlaySettings,
  BrandingInfo,
  NotchInfo,
} from "../shared-overlay/types";
import { FLASH_SHORT_MS } from "../shared-overlay/constants";
import { setIgnoreMouse } from "./lib/ipc";
import { speak, cancel as cancelTTS } from "./lib/tts";
import {
  useSpeechRecognition,
  type SpeechRecognitionState,
} from "./lib/whisper";
import {
  pillReducer,
  initialPillContext,
  type InteractionMode,
} from "./lib/notch-pill-state";
import { useMeetingRecorder } from "./meeting-recorder-stub";
import { useFlashMessage } from "./lib/use-flash-message";
import { useAIResponse } from "./lib/use-ai-response";
import { useActivationHandler } from "./lib/use-activation-handler";
import { useMeetingControls } from "./lib/use-meeting-controls";
import {
  SPRING,
  CONTENT_ENTER,
  CONTENT_EXIT,
  STAGGER_MS,
  ACTIVE_HEIGHT,
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
    silenceTimeoutMs: 2000,
    ttsEnabled: true,
    ttsRate: 1.05,
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
  const [branding, setBranding] = useState<BrandingInfo | null>(null);
  const [pill, dispatch] = useReducer(pillReducer, initialPillContext);
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_SETTINGS);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamAbortRef = useRef(false);

  const flash = useFlashMessage();
  const handleRecorderError = useCallback(
    (msg: string) => flash.show(msg, 3000),
    [flash.show]
  );
  const meetingRecorder = useMeetingRecorder(
    settings.meeting?.chunkIntervalMs ?? 5000,
    handleRecorderError
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

  useAIResponse(pill.state, pill.transcript, dispatch, streamAbortRef);

  const handleSilence = useCallback(() => {
    const p = pillRef.current;
    const s = speechRef.current;
    if (p.interactionMode !== "assistant" || p.state !== "listening" || !s)
      return;
    void s.stopListening().then((transcript) => {
      if (transcript) {
        dispatch({ type: "LISTENING_COMPLETE", transcript });
      } else {
        dismissRef.current();
      }
    });
  }, []);

  const speech = useSpeechRecognition({
    onSilence: handleSilence,
    silenceTimeoutMs: settings.voice.silenceTimeoutMs,
  });
  speechRef.current = speech;

  useEffect(() => {
    clearDismissTimer();
    if (pill.state === "response") {
      dismissTimerRef.current = setTimeout(
        dismiss,
        settings.behavior.autoDismissMs
      );
    }
    return clearDismissTimer;
  }, [pill.state, settings.behavior.autoDismissMs, dismiss, clearDismissTimer]);

  useEffect(() => {
    const mode = pill.interactionMode;
    if (
      pill.state === "response" &&
      settingsRef.current.voice.ttsEnabled &&
      (mode === "assistant" || mode === "continuous")
    ) {
      const text = pill.responseLines.join(". ");
      if (text) void speak(text, { rate: settingsRef.current.voice.ttsRate });
    }
  }, [pill.state, pill.responseLines, pill.interactionMode]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.removeAllListeners?.();
    api.getOverlaySettings?.().then((s) => setSettings(s)).catch(() => {});
    api.onNotchInfo?.((info: NotchInfo) => setConfig(info));
    api.onBranding?.((b: BrandingInfo) => setBranding(b));
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

  useEffect(() => {
    if (pill.state === "response" && measureRef.current) {
      const h = measureRef.current.offsetHeight;
      if (h > 0) setMeasuredHeight(h);
    }
  }, [pill.state, pill.responseTitle]);

  const hasNotch = config?.hasNotch ?? false;
  const notchHeight = config?.notchHeight ?? 0;
  const menuBarHeight = config?.menuBarHeight ?? 25;
  const windowWidth = config?.windowWidth ?? 400;
  const topPad = hasNotch ? notchHeight + 2 : 3;

  let pillHeight: number;
  if (pill.state === "idle") {
    pillHeight = menuBarHeight;
  } else if (pill.state === "response") {
    pillHeight = topPad + 24 + 12 + measuredHeight + 12;
  } else {
    pillHeight = topPad + ACTIVE_HEIGHT;
  }

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
    if (
      pill.interactionMode === "continuous" &&
      speech.transcript
    ) {
      const words = speech.transcript.split(/\s+/).length;
      return `${words} word${words === 1 ? "" : "s"}`;
    }
    if (
      (pill.interactionMode === "dictation" ||
        pill.interactionMode === "transcribe") &&
      speech.interimText
    ) {
      return speech.interimText;
    }
    return null;
  };

  const handleMouseEnter = useCallback(() => setIgnoreMouse(false), []);
  const handleMouseLeave = useCallback(() => setIgnoreMouse(true), []);

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

  const handleCloseOverlay = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      window.electronAPI?.hideOverlay?.();
      dismissRef.current();
    },
    []
  );

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
      </div>

      <motion.div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handlePillClick}
        animate={{ height: pillHeight }}
        transition={SPRING}
        style={{
          width: "100%",
          background: "var(--overlay-pill-bg)",
          borderRadius:
            pill.state === "idle"
              ? `0 0 var(--overlay-radius-idle) var(--overlay-radius-idle)`
              : `0 0 var(--overlay-radius-active) var(--overlay-radius-active)`,
          overflow: "hidden",
          position: "relative",
          cursor: pill.state === "idle" ? "pointer" : "default",
        }}
      >
        <button
          type="button"
          aria-label="Close overlay"
          onClick={handleCloseOverlay}
          style={{
            position: "absolute",
            top: pill.state === "idle" ? 3 : topPad + 3,
            right: 8,
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: "none",
            background: "var(--overlay-close-bg)",
            color: "var(--overlay-text-primary)",
            fontSize: 12,
            lineHeight: "18px",
            cursor: "pointer",
            zIndex: 2,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--overlay-close-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--overlay-close-bg)";
          }}
        >
          <XIcon size={10} weight="bold" aria-hidden="true" />
        </button>
        <div
          style={{
            paddingTop: pill.state === "idle" ? 0 : topPad,
            paddingLeft: 16,
            paddingRight: 30,
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
              <CompanyLogo logoUrl={branding?.logoUrl ?? null} />
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
                      background: "var(--overlay-accent-danger)",
                      flexShrink: 0,
                    }}
                  />
                  <MeetingTimer startedAt={pill.meetingStartedAt} />
                </>
              )}
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
                  color: "var(--overlay-accent-success)",
                  fontSize: "var(--overlay-font-md)",
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
                      color: "var(--overlay-text-primary)",
                      fontSize: "var(--overlay-font-lg)",
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {modeLabel()}
                  </span>
                  {modeDetail() && (
                    <span
                      style={{
                        color: "var(--overlay-text-muted)",
                        fontSize: "var(--overlay-font-sm)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {modeDetail()}
                    </span>
                  )}
                </div>
                <Waveform />
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
                      color: "var(--overlay-text-secondary)",
                      fontSize: "var(--overlay-font-md)",
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
                    color: "var(--overlay-text-secondary)",
                    fontSize: "var(--overlay-font-lg)",
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
                      color: "var(--overlay-text-primary)",
                      fontSize: "var(--overlay-font-lg)",
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
                  style={{ marginTop: 8, paddingLeft: 22 }}
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
                    fontSize: "var(--overlay-font-sm)",
                    color: "var(--overlay-text-done)",
                  }}
                >
                  Done
                </motion.div>
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
              "linear-gradient(90deg, transparent, var(--overlay-line-soft), transparent)",
          }}
        />
      </motion.div>
    </div>
  );
};
