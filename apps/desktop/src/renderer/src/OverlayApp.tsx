import { useEffect, useCallback, useRef, useState, useReducer } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { setIgnoreMouse } from "./lib/ipc";
import { speak, cancel as cancelTTS } from "./lib/tts";
import { useSpeechRecognition } from "./lib/whisper";
import { detectCommand } from "./lib/voice-commands";
import { useSilenceDetector } from "./lib/silence-detector";
import { pillReducer, initialPillContext } from "./lib/notch-pill-state";
import type { InteractionMode } from "./lib/notch-pill-state";

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------

const SPRING = { type: "spring" as const, stiffness: 500, damping: 35, mass: 0.8 };
const CONTENT_ENTER = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };
const CONTENT_EXIT = { duration: 0.12 };
const STAGGER_MS = 80;

// ---------------------------------------------------------------------------
// Heights
// ---------------------------------------------------------------------------

const IDLE_HEIGHT = 32;
const ACTIVE_HEIGHT = 48;

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: OverlaySettings = {
  shortcuts: { assistantToggle: "Control+Space", dictationToggle: "Control+Shift+Space" },
  voice: { language: "en-US", silenceTimeoutMs: 2000, ttsEnabled: true, ttsRate: 1.05 },
  behavior: { doubleTapWindowMs: 400, autoDismissMs: 5000, showDictationPreview: true },
};

// ---------------------------------------------------------------------------
// Simulated AI responses (used when API is unavailable)
// ---------------------------------------------------------------------------

const SIMULATED_RESPONSES = [
  { title: "Assistant", lines: ["I'd be happy to help with that.", "Let me look into it for you."] },
  { title: "Answer", lines: ["The quarterly review is scheduled for Friday at 2pm.", "Sarah and Alex are presenting."] },
  { title: "Summary", lines: ["3 relevant documents and 2 recent tasks match your query."] },
  { title: "Suggestion", lines: ["I can help you draft that email.", "Pulling in context from recent meetings."] },
];

let simIdx = 0;

const getSimulatedResponse = (transcript: string): { title: string; lines: string[] } => {
  const lower = transcript.toLowerCase();
  if (lower.includes("meeting") || lower.includes("schedule")) {
    return { title: "Meetings", lines: ["Your next meeting is the Weekly Sync at 2pm.", "Alex, Sarah, and 3 others."] };
  }
  if (lower.includes("task") || lower.includes("todo")) {
    return { title: "Tasks", lines: ["5 tasks in progress.", "2 due today: Design review and API docs."] };
  }
  if (lower.includes("search") || lower.includes("find")) {
    return { title: "Search", lines: ["Found 3 matching documents.", "Q1 Roadmap, Design System, Sprint Notes"] };
  }
  const resp = SIMULATED_RESPONSES[simIdx % SIMULATED_RESPONSES.length]!;
  simIdx++;
  return resp;
};

// ---------------------------------------------------------------------------
// AI streaming — tries real API, falls back to simulation
// ---------------------------------------------------------------------------

const streamAssistant = async (
  message: string,
  onToken: (token: string) => void,
  onComplete: (title: string, lines: string[]) => void,
): Promise<void> => {
  try {
    const apiUrl = await window.electronAPI?.getApiUrl();
    const sessionToken = await window.electronAPI?.getSessionToken();

    if (!apiUrl || !sessionToken) {
      await simulateResponse(message, onToken, onComplete);
      return;
    }

    const res = await fetch(`${apiUrl}/stream/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ message, history: [] }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok || !res.body) {
      await simulateResponse(message, onToken, onComplete);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") { onComplete("Assistant", fullText.split("\n").filter(Boolean)); return; }
        try {
          const parsed = JSON.parse(data) as { token?: string };
          if (parsed.token) { fullText += parsed.token; onToken(parsed.token); }
        } catch { /* skip */ }
      }
    }
    onComplete("Assistant", fullText.split("\n").filter(Boolean));
  } catch {
    await simulateResponse(message, onToken, onComplete);
  }
};

const simulateResponse = async (
  message: string,
  onToken: (token: string) => void,
  onComplete: (title: string, lines: string[]) => void,
): Promise<void> => {
  const resp = getSimulatedResponse(message);
  const words = resp.lines.join(" ").split(" ");
  for (let i = 0; i < words.length; i++) {
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 30));
    onToken((i > 0 ? " " : "") + words[i]);
  }
  onComplete(resp.title, resp.lines);
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const Sparkle = ({ active }: { active: boolean }): JSX.Element => (
  <motion.div
    animate={active
      ? { scale: [1, 1.2, 1], rotate: [0, 15, 0] }
      : { scale: [1, 1.06, 1], opacity: [0.4, 0.7, 0.4] }}
    transition={{ duration: active ? 0.5 : 2.8, repeat: active ? 0 : Infinity, ease: "easeInOut" }}
    style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: 14, height: 14 }}
  >
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 0C8.3 4.5 11.5 7.7 16 8C11.5 8.3 8.3 11.5 8 16C7.7 11.5 4.5 8.3 0 8C4.5 7.7 7.7 4.5 8 0Z" fill="white" fillOpacity={active ? 1 : 0.55} />
    </svg>
  </motion.div>
);

const PencilIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const MicIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const CompanyLogo = ({ logoUrl }: { logoUrl: string | null }): JSX.Element => {
  if (logoUrl) {
    return (
      <motion.img
        src={logoUrl}
        alt=""
        animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ width: 16, height: 16, borderRadius: 3, objectFit: "contain" }}
      />
    );
  }
  // Default: Basics OS logomark — rounded "b" lettermark
  return (
    <motion.div
      animate={{ opacity: [0.45, 0.75, 0.45] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16 }}
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <rect x="1" y="1" width="18" height="18" rx="5" fill="white" fillOpacity="0.15" />
        <path d="M7 5.5v9M7 10h2.5a2.5 2.5 0 0 0 0-5H7M7 10h3a2.5 2.5 0 0 1 0 5H7"
          stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.div>
  );
};

const Waveform = (): JSX.Element => {
  const [heights, setHeights] = useState([4, 8, 6, 10, 5]);
  useEffect(() => {
    const iv = setInterval(() => setHeights(Array.from({ length: 5 }, () => 3 + Math.random() * 13)), 100);
    return () => clearInterval(iv);
  }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 16 }}>
      {heights.map((h, i) => (
        <motion.div key={i} animate={{ height: h }} transition={{ type: "spring", stiffness: 600, damping: 20, mass: 0.3 }}
          style={{ width: 2, borderRadius: 1, background: "rgba(255,255,255,0.7)" }} />
      ))}
    </div>
  );
};

const ThinkingDots = (): JSX.Element => (
  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
    {[0, 1, 2].map((i) => (
      <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
        style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />
    ))}
  </div>
);

const ResponseBody = ({ response }: { response: { title: string; lines: string[] } }): JSX.Element => (
  <div>
    <div style={{ color: "#fff", fontSize: 13.5, lineHeight: 1.5, fontWeight: 400 }}>{response.lines[0]}</div>
    {response.lines.slice(1).map((line, i) => (
      <div key={`${response.title}-${i}`} style={{ color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.5, marginTop: 2 }}>{line}</div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// OverlayApp — the NotchPill (4 interaction modes)
// ---------------------------------------------------------------------------

export const OverlayApp = (): JSX.Element => {
  const [config, setConfig] = useState<NotchInfo | null>(null);
  const [branding, setBranding] = useState<BrandingInfo | null>(null);
  const [pill, dispatch] = useReducer(pillReducer, initialPillContext);
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_SETTINGS);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamAbortRef = useRef(false);

  const speech = useSpeechRecognition();

  // Refs for stable IPC listener access (avoids stale closures)
  const pillRef = useRef(pill);
  pillRef.current = pill;
  const speechRef = useRef(speech);
  speechRef.current = speech;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ---------------------------------------------------------------------------
  // Load settings + branding on mount (one-time IPC listeners)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    window.electronAPI?.getOverlaySettings().then((s) => setSettings(s)).catch(() => undefined);
    window.electronAPI?.onNotchInfo((info) => setConfig(info));
    window.electronAPI?.onBranding((b) => setBranding(b));
    window.electronAPI?.onSettingsChanged((s) => setSettings(s));
  }, []);

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
    if (speechRef.current.isListening) speechRef.current.stopListening();
    dispatch({ type: "DISMISS" });
    window.electronAPI?.notifyDismissed();
  };

  const dismiss = useCallback(() => dismissRef.current(), []);

  // ---------------------------------------------------------------------------
  // Silence detector — assistant mode only (auto-stop after silence)
  // ---------------------------------------------------------------------------
  const handleSilence = useCallback(() => {
    const p = pillRef.current;
    const s = speechRef.current;
    if (p.interactionMode !== "assistant" || p.state !== "listening") return;
    const transcript = s.stopListening();
    if (transcript) {
      dispatch({ type: "LISTENING_COMPLETE", transcript });
    } else {
      dismissRef.current();
    }
  }, []);

  useSilenceDetector(
    speech.transcript,
    settings.voice.silenceTimeoutMs,
    handleSilence,
    pill.state === "listening" && pill.interactionMode === "assistant",
  );

  // ---------------------------------------------------------------------------
  // Process transcript → thinking → AI (assistant + continuous modes)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (pill.state !== "thinking" || !pill.transcript) return;

    const cmd = detectCommand(pill.transcript);
    if (cmd) {
      switch (cmd.type) {
        case "navigate":
          dispatch({ type: "COMMAND_RESULT", title: `Opening ${cmd.module}`, lines: ["Navigating..."] });
          window.electronAPI?.navigateMain(cmd.url);
          return;
        case "create_task":
          dispatch({ type: "COMMAND_RESULT", title: "Task Created", lines: [cmd.title, "Added to your task list"] });
          return;
        case "search":
          dispatch({ type: "COMMAND_RESULT", title: "Searching", lines: [`"${cmd.query}"`, "Opening results..."] });
          window.electronAPI?.navigateMain(`/assistant?q=${encodeURIComponent(cmd.query)}`);
          return;
      }
    }

    streamAbortRef.current = false;
    void streamAssistant(
      pill.transcript,
      (token) => { if (!streamAbortRef.current) dispatch({ type: "AI_STREAMING", text: token }); },
      (title, lines) => { if (!streamAbortRef.current) dispatch({ type: "AI_COMPLETE", title, lines }); },
    );
  }, [pill.state, pill.transcript]);

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
    if (pill.state === "response" && settingsRef.current.voice.ttsEnabled) {
      const text = pill.responseLines.join(". ");
      if (text) void speak(text, { rate: settingsRef.current.voice.ttsRate });
    }
  }, [pill.state, pill.responseLines]);

  // ---------------------------------------------------------------------------
  // IPC listeners (register once, access state via refs)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const handleActivate = (mode: ActivationMode): void => {
      const cur = pillRef.current;
      const s = speechRef.current;

      if (cur.state !== "idle") {
        // --- DICTATION active, press again → stop, paste, dismiss ---
        if (cur.interactionMode === "dictation" && mode === "dictation") {
          const transcript = s.stopListening();
          if (transcript) {
            void api.injectText(transcript).then(() => {
              setFlashMessage("Pasted!");
              setTimeout(() => { setFlashMessage(null); dismissRef.current(); }, 800);
            });
          } else {
            dismissRef.current();
          }
          return;
        }

        // --- TRANSCRIBE active, press again → stop, copy to clipboard ---
        if (cur.interactionMode === "transcribe" && mode === "transcribe") {
          const transcript = s.stopListening();
          if (transcript) {
            void navigator.clipboard.writeText(transcript);
            setFlashMessage("Copied!");
            dispatch({ type: "DISMISS" });
            setTimeout(() => setFlashMessage(null), 800);
          } else {
            dismissRef.current();
          }
          return;
        }

        // --- CONTINUOUS active, assistant press → stop listening, send to AI ---
        if (cur.interactionMode === "continuous" && mode === "continuous") {
          const transcript = s.stopListening();
          if (transcript) {
            dispatch({ type: "LISTENING_COMPLETE", transcript });
          } else {
            dismissRef.current();
          }
          return;
        }

        // --- ASSISTANT active, press again → stop early, send what we have ---
        if (cur.interactionMode === "assistant" && mode === "assistant" && cur.state === "listening") {
          const transcript = s.stopListening();
          if (transcript) {
            dispatch({ type: "LISTENING_COMPLETE", transcript });
          } else {
            dismissRef.current();
          }
          return;
        }

        // Anything else while active → dismiss
        dismissRef.current();
        return;
      }

      // --- Start fresh activation ---
      dispatch({ type: "ACTIVATE", mode: mode as InteractionMode });
      s.startListening();
    };

    const handleDeactivate = (): void => {
      if (speechRef.current.isListening) speechRef.current.stopListening();
      dispatch({ type: "DEACTIVATE" });
    };

    api.onActivate(handleActivate);
    api.onDeactivate(handleDeactivate);
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
  const windowWidth = config?.windowWidth ?? 400;
  const topPad = hasNotch ? notchHeight + 2 : 6;

  let pillHeight: number;
  if (pill.state === "idle") {
    pillHeight = topPad + IDLE_HEIGHT;
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
        onClick={() => {
          if (pillRef.current.state === "idle") {
            dispatch({ type: "ACTIVATE", mode: "assistant" });
            speechRef.current.startListening();
          } else {
            dismissRef.current();
          }
        }}
        animate={{ height: pillHeight }}
        transition={SPRING}
        style={{ width: "100%", background: "#000", borderRadius: "0 0 16px 16px", overflow: "hidden", position: "relative", cursor: pill.state === "idle" ? "pointer" : "default" }}
      >
        <div style={{ paddingTop: topPad, paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
          {/* Idle: company logo or sparkle */}
          {pill.state === "idle" && !flashMessage && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 24 }}>
              <CompanyLogo logoUrl={branding?.logoUrl ?? null} />
            </div>
          )}

          {/* Flash message ("Pasted!" / "Copied!") */}
          {pill.state === "idle" && flashMessage && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 24 }}>
              <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ color: "#4ade80", fontSize: 13, fontWeight: 600 }}>
                {flashMessage}
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
