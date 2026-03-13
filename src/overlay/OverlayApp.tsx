import { useEffect, useCallback, useRef, useState, useReducer } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { OverlaySettings, NotchInfo } from "@/shared-overlay/types";
import { FLASH_SHORT_MS, FLASH_LONG_MS } from "@/shared-overlay/constants";
import { setIgnoreMouse, navigateMain } from "./lib/ipc";
import { cancel as cancelTTS } from "./lib/tts";
import {
  useSpeechRecognition,
  type SpeechRecognitionState,
} from "./lib/whisper";
import { pillReducer, initialPillContext } from "./lib/notch-pill-state";
import { useMeetingRecorder } from "./meeting-recorder";
import { useFlashMessage } from "./lib/use-flash-message";
import { useAIResponse } from "./lib/use-ai-response";
import { useActivationHandler } from "./lib/use-activation-handler";
import { useMeetingControls } from "./lib/use-meeting-controls";
import { saveMeetingNotes } from "./api";
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
  NotificationPill,
} from "./lib/pill-components";
import { SHORTCUT_DEFINITIONS } from "@/lib/shortcut-definitions";

const DEFAULT_SETTINGS: OverlaySettings = {
  shortcuts: {
    assistantToggle: SHORTCUT_DEFINITIONS.assistantToggle.electron,
    dictationToggle: SHORTCUT_DEFINITIONS.dictationToggle.electron,
    dictationHoldKey: SHORTCUT_DEFINITIONS.dictationToggle.electron,
    meetingToggle: SHORTCUT_DEFINITIONS.meetingToggle.electron,
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

// Module-level cache survives Vite HMR remounts so notch info isn't lost
let _cachedNotchInfo: NotchInfo | null = null;

const isOverlayMac =
  typeof navigator !== "undefined" &&
  /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform);

/** Convert an Electron accelerator string (e.g. "CommandOrControl+Space") to
 *  a human-readable label for the current platform. */
function acceleratorToLabel(acc: string): string {
  return acc
    .split("+")
    .map((part) => {
      switch (part.toLowerCase()) {
        case "commandorcontrol":
        case "cmdorctrl":
          return "Ctrl";
        case "command":
        case "cmd":
          return "⌘";
        case "control":
        case "ctrl":
          return "Ctrl";
        case "alt":
        case "option":
          return "Alt";
        case "shift":
          return "⇧";
        case "space":
          return "Space";
        default:
          // Uppercase single letters, pass the rest through
          return part.length === 1 ? part.toUpperCase() : part;
      }
    })
    .join("+");
}

export const OverlayApp = () => {
  const [config, setConfig] = useState<NotchInfo | null>(_cachedNotchInfo);
  const [pill, dispatch] = useReducer(pillReducer, initialPillContext);
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_SETTINGS);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [showLastResponse, setShowLastResponse] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamAbortRef = useRef(false);

  // Response pinning — click pill to pin, X to dismiss
  const [responsePinned, setResponsePinned] = useState(false);

  // Notepad state
  const [notepadOpen, setNotepadOpen] = useState(false);
  const [notepadLocked, setNotepadLocked] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState("");
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meetingNotesRef = useRef(meetingNotes);
  meetingNotesRef.current = meetingNotes;
  // Track last known meetingId so we can flush notes even after meetingId is cleared
  const lastMeetingIdRef = useRef<string | null>(null);

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
  if (pill.meetingId) lastMeetingIdRef.current = pill.meetingId;
  const speechRef = useRef<SpeechRecognitionState | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const handleNotificationDismiss = useCallback(() => {
    dispatch({ type: "NOTIFICATION_DISMISS" });
  }, []);

  const handleRespondInChat = useCallback(
    (context?: string) => {
      const tid = pillRef.current.threadId;
      const base = tid ? `/chat/${tid}` : "/chat";
      const path = context
        ? `${base}?context=${encodeURIComponent(context)}`
        : base;
      navigateMain(path);
      dispatch({ type: "NOTIFICATION_DISMISS" });
    },
    [],
  );

  const dismissRef = useRef(() => {});
  dismissRef.current = () => {
    cancelTTS();
    clearDismissTimer();
    streamAbortRef.current = true;
    setResponsePinned(false);
    setShowLastResponse(false);
    setIgnoreMouse(true);
    const s = speechRef.current;
    if (s?.isListening) {
      void s.stopListening();
    }
    if (pillRef.current.state === "notification") {
      dispatch({ type: "NOTIFICATION_DISMISS" });
    } else {
      dispatch({ type: "DISMISS" });
    }
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
    getNotesRef: () => meetingNotesRef.current,
  });

  useAIResponse(
    pill.state,
    pill.transcript,
    pill.conversationHistory,
    pill.pendingVoiceContext,
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
      if (pill.needsFollowUp) {
        // Show response briefly, then auto-listen for follow-up
        dismissTimerRef.current = setTimeout(() => {
          const s = speechRef.current;
          if (s) {
            dispatch({ type: "ACTIVATE", mode: "assistant" });
            s.startListening();
          }
        }, 2500);
      } else {
        dismissTimerRef.current = setTimeout(
          dismiss,
          settings.behavior.autoDismissMs,
        );
      }
    }
    if (pill.state === "notification") {
      dismissTimerRef.current = setTimeout(dismiss, 30_000);
    }
    if (pill.state !== "idle") {
      setShowLastResponse(false);
    }
    return clearDismissTimer;
  }, [pill.state, pill.needsFollowUp, settings.behavior.autoDismissMs, dismiss, clearDismissTimer]);

  // TTS disabled

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.removeAllListeners?.();
    api
      .getOverlaySettings?.()
      .then((s) => setSettings(s))
      .catch(() => {});
    api.onNotchInfo?.((info: NotchInfo) => {
      _cachedNotchInfo = info;
      setConfig(info);
    });
    api.onSettingsChanged?.((s: OverlaySettings) => setSettings(s));

    api.onActivate?.(activation.handleActivate);
    api.onDeactivate?.(activation.handleDeactivate);
    api.onHoldStart?.(activation.handleHoldStart);
    api.onHoldEnd?.(activation.handleHoldEnd);

    api.onMeetingToggle?.(meeting.handleMeetingToggle);
    api.onMeetingStarted?.(meeting.handleMeetingStarted);
    api.onMeetingStopped?.(meeting.handleMeetingStopped);
    api.onSystemAudioTranscript?.(meeting.handleSystemAudioTranscript);
    api.onNotification?.((payload) => {
      dispatch({
        type: "NOTIFICATION",
        title: payload.title,
        body: payload.body,
        actions: payload.actions,
        context: payload.context,
      });
    });

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

  // Flush notes save and reset notepad when meeting ends
  useEffect(() => {
    if (!pill.meetingActive) {
      // Meeting just ended — flush any pending save
      if (notesSaveTimerRef.current) {
        clearTimeout(notesSaveTimerRef.current);
        notesSaveTimerRef.current = null;
      }
      // Use lastMeetingIdRef since pill.meetingId is already null by now
      const mid = lastMeetingIdRef.current;
      if (meetingNotesRef.current && mid) {
        saveMeetingNotes(mid, meetingNotesRef.current).catch(() => {});
      }
      setNotepadOpen(false);
      setNotepadLocked(false);
      setMeetingNotes("");
      lastMeetingIdRef.current = null;
    }
  }, [pill.meetingActive]);

  const debouncedSaveNotes = useCallback(
    (text: string) => {
      if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
      notesSaveTimerRef.current = setTimeout(() => {
        const mid = pillRef.current.meetingId ?? lastMeetingIdRef.current;
        if (mid && text) {
          saveMeetingNotes(mid, text).catch(() => {});
        }
      }, 1500);
    },
    [],
  );

  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setMeetingNotes(text);
      debouncedSaveNotes(text);
    },
    [debouncedSaveNotes],
  );

  const handleNotesBlur = useCallback(() => {
    // Immediate save on blur
    if (notesSaveTimerRef.current) {
      clearTimeout(notesSaveTimerRef.current);
      notesSaveTimerRef.current = null;
    }
    const mid = pillRef.current.meetingId ?? lastMeetingIdRef.current;
    if (mid && meetingNotesRef.current) {
      saveMeetingNotes(mid, meetingNotesRef.current).catch(() => {});
    }
  }, []);

  // Auto-insert bullet points on Enter
  const handleNotesKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter") {
        const textarea = e.currentTarget;
        const { selectionStart, value } = textarea;
        const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
        const currentLine = value.slice(lineStart, selectionStart);

        // If current line starts with "• " or "- ", auto-continue the bullet
        const bulletMatch = currentLine.match(/^([•-]\s)/);
        if (bulletMatch) {
          // If the line is just a bullet with no content, remove it instead
          if (currentLine.trim() === bulletMatch[1].trim()) {
            e.preventDefault();
            const newValue =
              value.slice(0, lineStart) + "\n" + value.slice(selectionStart);
            setMeetingNotes(newValue);
            debouncedSaveNotes(newValue);
            // Set cursor position after React re-render
            requestAnimationFrame(() => {
              textarea.selectionStart = textarea.selectionEnd = lineStart + 1;
            });
            return;
          }
          e.preventDefault();
          const bullet = bulletMatch[1];
          const insertion = "\n" + bullet;
          const newValue =
            value.slice(0, selectionStart) +
            insertion +
            value.slice(selectionStart);
          setMeetingNotes(newValue);
          debouncedSaveNotes(newValue);
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd =
              selectionStart + insertion.length;
          });
        }
      }
      e.stopPropagation();
    },
    [debouncedSaveNotes],
  );

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

  // Response layout: title(24) + bodyGap(8) + body(responseContentH) + bottomPad(28)
  const RESPONSE_EXTRA_H = 24 + 8 + 28;

  const NOTEPAD_AREA_H = 120; // textarea area height
  const NOTEPAD_GAP = 4;

  let pillHeight: number;
  const responseContentH = Math.min(
    Math.max(measuredHeight, 40), // at least 40px while measuring
    maxResponseBodyHeight,
  );
  if (pill.state === "idle" && showLastResponse) {
    pillHeight = topPad + RESPONSE_EXTRA_H + responseContentH;
  } else if (pill.state === "idle" && pill.meetingActive && notepadOpen) {
    // menuBar + gap + textarea + bottom padding
    pillHeight = menuBarHeight + NOTEPAD_GAP + NOTEPAD_AREA_H + 10;
  } else if (pill.state === "idle") {
    pillHeight = menuBarHeight;
  } else if (pill.state === "notification") {
    pillHeight = topPad + 200;
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
    // Expand notepad on hover during meeting
    if (
      pillRef.current.state === "idle" &&
      pillRef.current.meetingActive
    ) {
      setNotepadOpen(true);
    }
  }, [clearDismissTimer]);

  const handleMouseLeave = useCallback(() => {
    // Keep mouse interactive when response is pinned so user can click X
    if (!responsePinned) {
      setIgnoreMouse(true);
      setShowLastResponse(false);
    }
    // Collapse notepad if not locked
    if (!notepadLocked) {
      setNotepadOpen(false);
    }
    // Restart dismiss timer if still in response state and not pinned
    if (pillRef.current.state === "response" && !responsePinned) {
      clearDismissTimer();
      dismissTimerRef.current = setTimeout(
        () => dismissRef.current(),
        settingsRef.current.behavior.autoDismissMs,
      );
    }
  }, [clearDismissTimer, notepadLocked, responsePinned]);

  const handlePillClick = useCallback(() => {
    const cur = pillRef.current;
    if (cur.state === "idle" && cur.meetingActive) {
      // Any click during meeting → open + lock notepad
      setNotepadOpen(true);
      setNotepadLocked(true);
      return;
    }
    if (cur.state === "response" || (cur.state === "idle" && showLastResponse)) {
      // Pin the response so it stays visible until X is clicked
      setResponsePinned(true);
      clearDismissTimer();
      return;
    }
    // All other clicks do nothing — use keyboard shortcuts to activate
  }, [showLastResponse, clearDismissTimer]);

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
          borderRadius:
            pill.state === "idle" && notepadOpen
              ? "0 0 14px 14px"
              : pill.state === "idle"
                ? "0 0 8px 8px"
                : "0 0 16px 16px",
          overflow: "hidden",
          position: "relative",
          cursor: "default",
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
            <>
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
                {/* spacer + toggle */}
                <div style={{ marginLeft: "auto" }} />
                {notepadOpen && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (notepadLocked) {
                        setNotepadLocked(false);
                        setNotepadOpen(false);
                      } else {
                        setNotepadLocked(true);
                      }
                    }}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      background: notepadLocked
                        ? "rgba(255,255,255,0.12)"
                        : "transparent",
                      transition: "all 0.15s ease",
                    }}
                    title={notepadLocked ? "Close notepad" : "Keep notepad open"}
                  >
                    {notepadLocked ? (
                      // X icon to close
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 2L8 8M8 2L2 8" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    ) : (
                      // Pin dot to lock
                      <div
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.3)",
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
              {notepadOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: NOTEPAD_AREA_H }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{ marginTop: NOTEPAD_GAP }}
                >
                  {/* Subtle separator line */}
                  <div
                    style={{
                      height: 1,
                      background:
                        "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent 95%)",
                      marginBottom: 6,
                    }}
                  />
                  <textarea
                    value={meetingNotes}
                    onChange={handleNotesChange}
                    onBlur={handleNotesBlur}
                    onKeyDown={handleNotesKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="- Key points, decisions, action items..."
                    autoFocus={notepadLocked}
                    style={{
                      width: "100%",
                      height: NOTEPAD_AREA_H - 7, // minus separator
                      background: "transparent",
                      border: "none",
                      color: "rgba(255,255,255,0.85)",
                      fontSize: 12.5,
                      lineHeight: "1.65",
                      padding: "4px 2px",
                      resize: "none",
                      outline: "none",
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
                      letterSpacing: "-0.01em",
                      boxSizing: "border-box",
                      caretColor: "rgba(255,255,255,0.6)",
                    }}
                  />
                </motion.div>
              )}
            </>
          )}

          {pill.state === "idle" && flash.message && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                height: menuBarHeight,
              }}
            >
              <span
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 11,
                  fontWeight: 500,
                  opacity: flash.fading ? 0 : 1,
                  transition: "opacity 0.4s ease-out",
                }}
              >
                {flash.message}
              </span>
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

            {pill.state === "notification" && (
              <motion.div
                key="notification"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={CONTENT_ENTER}
                style={{ paddingBottom: 8, paddingLeft: 6, paddingRight: 6 }}
              >
                <NotificationPill
                  title={pill.notificationTitle}
                  body={pill.notificationBody}
                  actions={pill.notificationActions}
                  assistantShortcutLabel={
                    (isOverlayMac ? settings.shortcuts?.assistant?.label : undefined) ??
                    acceleratorToLabel(
                      settings.shortcuts?.assistantToggle ?? "CommandOrControl+Space",
                    )
                  }
                  onRespondWithVoice={() =>
                    activation.handleActivate("assistant")
                  }
                  onRespondInChat={() =>
                    handleRespondInChat(pill.notificationContext || undefined)
                  }
                  onDismiss={handleNotificationDismiss}
                />
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
                      flex: 1,
                    }}
                  >
                    {currentResponse.title}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissRef.current();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        dismissRef.current();
                      }
                    }}
                    style={{
                      color: "rgba(255,255,255,0.35)",
                      fontSize: 13,
                      cursor: "pointer",
                      padding: "0 2px",
                      lineHeight: 1,
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}
                  >
                    ✕
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
                    marginTop: 10,
                    paddingLeft: 22,
                    paddingBottom: 16,
                    paddingRight: 4,
                    maxHeight: maxResponseBodyHeight,
                    overflowY: "auto",
                    overflowX: "hidden",
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.15) transparent",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <ResponseBody response={currentResponse} />
                </motion.div>
                {pill.needsFollowUp && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    transition={{
                      ...CONTENT_ENTER,
                      delay: (STAGGER_MS * 2) / 1000,
                    }}
                    style={{
                      textAlign: "right",
                      marginTop: 8,
                      marginBottom: 12,
                      paddingRight: 22,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 4,
                    }}
                  >
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      Press the assistant key to reply with voice, or open chat to continue.
                    </motion.span>
                  </motion.div>
                )}
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
                        flex: 1,
                      }}
                    >
                      {pill.lastResponseTitle}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLastResponse(false);
                        setResponsePinned(false);
                        setIgnoreMouse(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          setShowLastResponse(false);
                          setResponsePinned(false);
                          setIgnoreMouse(true);
                        }
                      }}
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        fontSize: 13,
                        cursor: "pointer",
                        padding: "0 2px",
                        lineHeight: 1,
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}
                    >
                      ✕
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      paddingLeft: 22,
                      paddingBottom: 12,
                      paddingRight: 4,
                      maxHeight: maxResponseBodyHeight,
                      overflowY: "auto",
                      overflowX: "hidden",
                      scrollbarWidth: "thin",
                      scrollbarColor: "rgba(255,255,255,0.15) transparent",
                      WebkitOverflowScrolling: "touch",
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
