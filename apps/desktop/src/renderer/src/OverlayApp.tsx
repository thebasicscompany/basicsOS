import { useEffect, useCallback, useRef, useState, useReducer } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { OverlaySettings, BrandingInfo, NotchInfo } from "../../shared/types.js";
import { FLASH_SHORT_MS } from "../../shared/constants.js";
import { createDesktopLogger } from "../../shared/logger.js";
import { setIgnoreMouse } from "./lib/ipc";
import { speak, cancel as cancelTTS } from "./lib/tts";
import { useSpeechRecognition } from "./lib/whisper";
import { useSilenceDetector } from "./lib/silence-detector";
import { pillReducer, initialPillContext } from "./lib/notch-pill-state";
import type { InteractionMode } from "./lib/notch-pill-state";
import { useMeetingRecorder } from "./lib/meeting-recorder";
import { useFlashMessage } from "./lib/use-flash-message";
import { useAIResponse } from "./lib/use-ai-response";
import { useActivationHandler } from "./lib/use-activation-handler";
import { useMeetingControls } from "./lib/use-meeting-controls";
import {
  SPRING, CONTENT_ENTER, CONTENT_EXIT, STAGGER_MS, ACTIVE_HEIGHT,
  Sparkle, PencilIcon, MicIcon, CompanyLogo, Waveform, ThinkingDots, ResponseBody, MeetingTimer,
} from "./lib/pill-components";

const log = createDesktopLogger("overlay");

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: OverlaySettings = {
  shortcuts: { assistantToggle: "CommandOrControl+Space", dictationToggle: "CommandOrControl+Shift+Space", dictationHoldKey: "CommandOrControl+Shift+Space", meetingToggle: "CommandOrControl+Alt+Space" },
  voice: { language: "en-US", silenceTimeoutMs: 2000, ttsEnabled: true, ttsRate: 1.05 },
  behavior: { doubleTapWindowMs: 400, autoDismissMs: 5000, showDictationPreview: true, holdThresholdMs: 150 },
  meeting: { autoDetect: false, chunkIntervalMs: 5000 },
};

// ---------------------------------------------------------------------------
// OverlayApp — the NotchPill (4 interaction modes)
// ---------------------------------------------------------------------------

export const OverlayApp = (): JSX.Element => {
  const [config, setConfig] = useState<NotchInfo | null>(null);
  const [branding, setBranding] = useState<BrandingInfo | null>(null);
  const [pill, dispatch] = useReducer(pillReducer, initialPillContext);
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_SETTINGS);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamAbortRef = useRef(false);

  const speech = useSpeechRecognition();
  const flash = useFlashMessage();
  const handleRecorderError = useCallback((msg: string) => flash.show(msg, 3000), [flash.show]);
  const meetingRecorder = useMeetingRecorder(settings.meeting?.chunkIntervalMs ?? 5000, handleRecorderError);
  const meetingRecorderRef = useRef(meetingRecorder);
  meetingRecorderRef.current = meetingRecorder;

  // Refs for stable IPC listener access (avoids stale closures)
  const pillRef = useRef(pill);
  pillRef.current = pill;
  const speechRef = useRef(speech);
  speechRef.current = speech;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ---------------------------------------------------------------------------
  // Timer management
  // ---------------------------------------------------------------------------
  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) { clearTimeout(dismissTimerRef.current); dismissTimerRef.current = null; }
  }, []);

  const dismissRef = useRef(() => { /* placeholder */ });
  dismissRef.current = () => {
    cancelTTS();
    clearDismissTimer();
    streamAbortRef.current = true;
    if (speechRef.current.isListening) {
      void speechRef.current.stopListening();
    }
    dispatch({ type: "DISMISS" });
    window.electronAPI?.notifyDismissed();
  };

  const dismiss = useCallback(() => dismissRef.current(), []);

  // ---------------------------------------------------------------------------
  // Extracted hooks
  // ---------------------------------------------------------------------------

  const activation = useActivationHandler({
    dispatch, pillRef, speechRef, dismissRef, showFlash: flash.show,
  });

  const meeting = useMeetingControls({
    dispatch, pillRef, meetingRecorderRef, showFlash: flash.show,
  });

  useAIResponse(pill.state, pill.transcript, dispatch, streamAbortRef);

  // ---------------------------------------------------------------------------
  // Silence detector — assistant mode only (auto-stop after silence)
  // ---------------------------------------------------------------------------
  const handleSilence = useCallback(() => {
    const p = pillRef.current;
    if (p.interactionMode !== "assistant" || p.state !== "listening") return;
    void speechRef.current.stopListening().then((transcript) => {
      if (transcript) {
        dispatch({ type: "LISTENING_COMPLETE", transcript });
      } else {
        dismissRef.current();
      }
    });
  }, []);

  useSilenceDetector(
    speech.transcript,
    settings.voice.silenceTimeoutMs,
    handleSilence,
    pill.state === "listening" && pill.interactionMode === "assistant",
  );

  // ---------------------------------------------------------------------------
  // Auto-dismiss on response
  // ---------------------------------------------------------------------------
  useEffect(() => {
    clearDismissTimer();
    if (pill.state === "response") {
      dismissTimerRef.current = setTimeout(dismiss, settings.behavior.autoDismissMs);
    }
    return clearDismissTimer;
  }, [pill.state, settings.behavior.autoDismissMs, dismiss, clearDismissTimer]);

  // ---------------------------------------------------------------------------
  // TTS on response
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const mode = pill.interactionMode;
    if (pill.state === "response" && settingsRef.current.voice.ttsEnabled && (mode === "assistant" || mode === "continuous")) {
      const text = pill.responseLines.join(". ");
      if (text) void speak(text, { rate: settingsRef.current.voice.ttsRate });
    }
  }, [pill.state, pill.responseLines, pill.interactionMode]);

  // ---------------------------------------------------------------------------
  // IPC listeners (single registration point, cleanup via removeAllListeners)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    // Clean up any stale listeners from HMR
    api.removeAllListeners?.();

    // Settings, notch info, and branding
    api.getOverlaySettings().then((s) => setSettings(s)).catch(() => undefined);
    api.onNotchInfo((info) => setConfig(info));
    api.onBranding((b) => setBranding(b));
    api.onSettingsChanged((s) => setSettings(s));

    // Activation handlers
    api.onActivate(activation.handleActivate);
    api.onDeactivate(activation.handleDeactivate);
    api.onHoldStart?.(activation.handleHoldStart);
    api.onHoldEnd?.(activation.handleHoldEnd);

    // Accessibility check
    api.checkAccessibility?.().then((trusted) => {
      if (!trusted) log.warn("Accessibility permission not granted — text injection may fail");
    }).catch(() => undefined);

    // Meeting handlers
    api.onMeetingToggle?.(meeting.handleMeetingToggle);
    api.onMeetingStarted?.(meeting.handleMeetingStarted);
    api.onMeetingStopped?.(meeting.handleMeetingStopped);
    api.onSystemAudioTranscript?.(meeting.handleSystemAudioTranscript);

    // Restore meeting state on mount
    meeting.restoreMeetingState();
    meeting.restorePersistedMeeting();

    return () => { api.removeAllListeners?.(); };
  }, []);

  // Notify main when idle
  useEffect(() => {
    if (pill.state === "idle") {
      cancelTTS();
      window.electronAPI?.notifyDismissed();
    }
  }, [pill.state]);

  // ---------------------------------------------------------------------------
  // Escape key
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && pillRef.current.state !== "idle") {
        e.preventDefault();
        dismissRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------------------------------------------------------------------------
  // Measure response content
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (pill.state === "response" && measureRef.current) {
      const h = measureRef.current.offsetHeight;
      if (h > 0) setMeasuredHeight(h);
    }
  }, [pill.state, pill.responseTitle]);

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
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

  const currentResponse = { title: pill.responseTitle, lines: pill.responseLines };

  // ---------------------------------------------------------------------------
  // Mode-specific labels + icons
  // ---------------------------------------------------------------------------
  const modeIcon = (): JSX.Element => {
    switch (pill.interactionMode) {
      case "dictation": return <PencilIcon />;
      case "transcribe": return <MicIcon />;
      default: return <Sparkle active />;
    }
  };

  const modeLabel = (): string => {
    switch (pill.interactionMode) {
      case "assistant": return "Listening...";
      case "continuous": return "Listening (continuous)...";
      case "dictation": return "Dictating...";
      case "transcribe": return "Transcribing...";
    }
  };

  const modeDetail = (): string | null => {
    if (pill.interactionMode === "continuous" && speech.transcript) {
      const words = speech.transcript.split(/\s+/).length;
      return `${words} word${words === 1 ? "" : "s"}`;
    }
    if ((pill.interactionMode === "dictation" || pill.interactionMode === "transcribe") && speech.interimText) {
      return speech.interimText;
    }
    return null;
  };

  // ---------------------------------------------------------------------------
  // Mouse handling
  // ---------------------------------------------------------------------------
  const handleMouseEnter = useCallback(() => setIgnoreMouse(false), []);
  const handleMouseLeave = useCallback(() => setIgnoreMouse(true), []);

  // ---------------------------------------------------------------------------
  // Pill click handler
  // ---------------------------------------------------------------------------
  const handlePillClick = useCallback(() => {
    const cur = pillRef.current;
    if (cur.state === "idle") {
      dispatch({ type: "ACTIVATE", mode: "dictation" as InteractionMode });
      speechRef.current.startListening();
    } else if (cur.state === "listening" && cur.interactionMode === "dictation") {
      dispatch({ type: "TRANSCRIBING_START" });
      speechRef.current.stopListening().then((transcript) => {
        if (transcript) {
          window.electronAPI?.injectText(transcript).then(() => {
            dispatch({ type: "TRANSCRIBING_COMPLETE", transcript });
            flash.show("Copied! \u2318V to paste", FLASH_SHORT_MS);
            setTimeout(() => dismissRef.current(), FLASH_SHORT_MS);
          }).catch(() => dismissRef.current());
        } else {
          dismissRef.current();
        }
      }).catch(() => dismissRef.current());
    } else {
      dismissRef.current();
    }
  }, [flash]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      {/* Hidden measurer */}
      <div ref={measureRef} aria-hidden="true" style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", width: windowWidth - 32, paddingLeft: 22 }}>
        {pill.state === "response" && <ResponseBody response={currentResponse} />}
      </div>

      {/* The pill */}
      <motion.div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handlePillClick}
        animate={{ height: pillHeight }}
        transition={SPRING}
        style={{ width: "100%", background: "#000", borderRadius: pill.state === "idle" ? "0 0 8px 8px" : "0 0 16px 16px", overflow: "hidden", position: "relative", cursor: pill.state === "idle" ? "pointer" : "default" }}
      >
        <div style={{ paddingTop: pill.state === "idle" ? 0 : topPad, paddingLeft: 16, paddingRight: 16, paddingBottom: pill.state === "idle" ? 0 : 12 }}>
          {/* Idle: company logo or sparkle */}
          {pill.state === "idle" && !flash.message && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", height: menuBarHeight, gap: 6 }}>
              <CompanyLogo logoUrl={branding?.logoUrl ?? null} />
              {pill.meetingActive && (
                <>
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }}
                  />
                  <MeetingTimer startedAt={pill.meetingStartedAt} />
                </>
              )}
            </div>
          )}

          {/* Flash message */}
          {pill.state === "idle" && flash.message && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", height: menuBarHeight }}>
              <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ color: "#4ade80", fontSize: 13, fontWeight: 600 }}>
                {flash.message}
              </motion.span>
            </div>
          )}

          {/* Active states */}
          <AnimatePresence mode="wait">
            {pill.state === "listening" && (
              <motion.div key="listening" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={CONTENT_ENTER}
                style={{ display: "flex", alignItems: "center", height: 24, gap: 8 }}>
                {modeIcon()}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ color: "#fff", fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.01em" }}>{modeLabel()}</span>
                  {modeDetail() && (
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {modeDetail()}
                    </span>
                  )}
                </div>
                <Waveform />
              </motion.div>
            )}

            {pill.state === "thinking" && (
              <motion.div key="thinking" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={CONTENT_ENTER}
                style={{ display: "flex", alignItems: "center", height: 24, gap: 8 }}>
                <Sparkle active />
                {pill.streamingText ? (
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {pill.streamingText.slice(-80)}
                  </span>
                ) : (
                  <ThinkingDots />
                )}
              </motion.div>
            )}

            {pill.state === "transcribing" && (
              <motion.div key="transcribing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={CONTENT_ENTER}
                style={{ display: "flex", alignItems: "center", height: 24, gap: 8 }}>
                <ThinkingDots />
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13.5, fontWeight: 500 }}>
                  Transcribing...
                </span>
              </motion.div>
            )}

            {pill.state === "response" && (
              <motion.div key={`response-${pill.responseTitle}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={CONTENT_EXIT}>
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...CONTENT_ENTER, delay: 0 }}
                  style={{ display: "flex", alignItems: "center", height: 24, gap: 8 }}>
                  <Sparkle active />
                  <span style={{ color: "#fff", fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em" }}>{currentResponse.title}</span>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...CONTENT_ENTER, delay: STAGGER_MS / 1000 }}
                  style={{ marginTop: 8, paddingLeft: 22 }}>
                  <ResponseBody response={currentResponse} />
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} transition={{ ...CONTENT_ENTER, delay: (STAGGER_MS * 2) / 1000 }}
                  style={{ textAlign: "right", marginTop: 6, fontSize: 11, color: "#fff" }}>
                  Done
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom edge highlight */}
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "50%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)" }} />
      </motion.div>
    </div>
  );
};
