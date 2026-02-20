import { useEffect, useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { setIgnoreMouse } from "./lib/ipc";
import { speak, cancel as cancelTTS } from "./lib/tts";

// ---------------------------------------------------------------------------
// Mock responses (rotate through on each activation)
// ---------------------------------------------------------------------------

const MOCK_RESPONSES = [
  { title: "Task Created", lines: ["Buy groceries", "Added to your task list"] },
  { title: "Search Results", lines: ["3 results found", "Q1 Roadmap · Design System · Sprint Notes"] },
  { title: "Assistant", lines: ["The quarterly review is scheduled for Friday at 2pm.", "Sarah and Alex are presenting."] },
  { title: "Meeting", lines: ["Weekly Product Sync starting", "Alex, Sarah, and 3 others joined"] },
];

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------

const SPRING = { type: "spring" as const, stiffness: 500, damping: 35, mass: 0.8 };
const CONTENT_ENTER = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };
const CONTENT_EXIT = { duration: 0.12 };
const STAGGER_MS = 80;

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

const LISTENING_DURATION = 2500;
const THINKING_DURATION = 1500;
const RESPONSE_DISMISS = 5000;

// ---------------------------------------------------------------------------
// Heights
// ---------------------------------------------------------------------------

const IDLE_HEIGHT = 32;
const ACTIVE_HEIGHT = 48;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const Sparkle = ({ active }: { active: boolean }): JSX.Element => (
  <motion.div
    animate={
      active
        ? { scale: [1, 1.2, 1], rotate: [0, 15, 0] }
        : { scale: [1, 1.06, 1], opacity: [0.4, 0.7, 0.4] }
    }
    transition={{
      duration: active ? 0.5 : 2.8,
      repeat: active ? 0 : Infinity,
      ease: "easeInOut",
    }}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      width: 14,
      height: 14,
    }}
  >
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 0C8.3 4.5 11.5 7.7 16 8C11.5 8.3 8.3 11.5 8 16C7.7 11.5 4.5 8.3 0 8C4.5 7.7 7.7 4.5 8 0Z"
        fill="white"
        fillOpacity={active ? 1 : 0.55}
      />
    </svg>
  </motion.div>
);

const Waveform = (): JSX.Element => {
  const [heights, setHeights] = useState([4, 8, 6, 10, 5]);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeights(Array.from({ length: 5 }, () => 3 + Math.random() * 13));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 16 }}>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          animate={{ height: h }}
          transition={{ type: "spring", stiffness: 600, damping: 20, mass: 0.3 }}
          style={{ width: 2, borderRadius: 1, background: "rgba(255,255,255,0.7)" }}
        />
      ))}
    </div>
  );
};

const ThinkingDots = (): JSX.Element => (
  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
        style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }}
      />
    ))}
  </div>
);

const ResponseBody = ({ response }: { response: { title: string; lines: string[] } }): JSX.Element => (
  <div>
    <div style={{ color: "#fff", fontSize: 13.5, lineHeight: 1.5, fontWeight: 400, letterSpacing: "-0.008em" }}>
      {response.lines[0]}
    </div>
    {response.lines.slice(1).map((line, i) => (
      <div
        key={`${response.title}-${i}`}
        style={{ color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.5, marginTop: 2 }}
      >
        {line}
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// OverlayApp — the NotchPill (simulation mode)
// ---------------------------------------------------------------------------

type PillState = "idle" | "listening" | "thinking" | "response";

export const OverlayApp = (): JSX.Element => {
  const [config, setConfig] = useState<NotchInfo | null>(null);
  const [state, setState] = useState<PillState>("idle");
  const [responseIdx, setResponseIdx] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Receive notch config from main process
  // ---------------------------------------------------------------------------
  useEffect(() => {
    window.electronAPI?.onNotchInfo((info) => setConfig(info));
  }, []);

  // ---------------------------------------------------------------------------
  // Timer management
  // ---------------------------------------------------------------------------
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const goTo = useCallback(
    (next: PillState) => {
      clearTimer();
      setState(next);
    },
    [clearTimer],
  );

  const dismiss = useCallback(() => {
    cancelTTS();
    goTo("idle");
    window.electronAPI?.notifyDismissed();
  }, [goTo]);

  const activate = useCallback(() => {
    if (state !== "idle") {
      dismiss();
      return;
    }
    goTo("listening");
  }, [state, goTo, dismiss]);

  // ---------------------------------------------------------------------------
  // Auto-advance timers
  // ---------------------------------------------------------------------------
  useEffect(() => {
    clearTimer();
    if (state === "listening") {
      timerRef.current = setTimeout(() => goTo("thinking"), LISTENING_DURATION);
    } else if (state === "thinking") {
      timerRef.current = setTimeout(() => {
        setResponseIdx((i) => (i + 1) % MOCK_RESPONSES.length);
        goTo("response");
      }, THINKING_DURATION);
    } else if (state === "response") {
      timerRef.current = setTimeout(dismiss, RESPONSE_DISMISS);
    }
    return clearTimer;
  }, [state, goTo, dismiss, clearTimer]);

  // ---------------------------------------------------------------------------
  // IPC listeners from Electron
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.onActivate(() => {
      setState((prev) => (prev === "idle" ? "listening" : "idle"));
    });
    api.onDeactivate(() => {
      setState("idle");
    });
  }, []);

  // Notify main when idle
  useEffect(() => {
    if (state === "idle") {
      cancelTTS();
      window.electronAPI?.notifyDismissed();
    }
  }, [state]);

  // ---------------------------------------------------------------------------
  // Escape key
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && state !== "idle") {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, dismiss]);

  // ---------------------------------------------------------------------------
  // TTS on response
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state === "response") {
      const resp = MOCK_RESPONSES[responseIdx];
      if (resp) speak(resp.lines.join(". "));
    }
  }, [state, responseIdx]);

  // ---------------------------------------------------------------------------
  // Measure response content
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state === "response" && measureRef.current) {
      const h = measureRef.current.offsetHeight;
      if (h > 0) setMeasuredHeight(h);
    }
  }, [state, responseIdx]);

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
  const hasNotch = config?.hasNotch ?? false;
  const notchHeight = config?.notchHeight ?? 0;
  const windowWidth = config?.windowWidth ?? 400;

  const topPad = hasNotch ? notchHeight + 2 : 6;

  let pillHeight: number;
  if (state === "idle") {
    pillHeight = topPad + IDLE_HEIGHT;
  } else if (state === "response") {
    pillHeight = topPad + 24 + 12 + measuredHeight + 12;
  } else {
    pillHeight = topPad + ACTIVE_HEIGHT;
  }

  const currentResponse = MOCK_RESPONSES[responseIdx] ?? MOCK_RESPONSES[0];

  // ---------------------------------------------------------------------------
  // Mouse handling for click-through
  // ---------------------------------------------------------------------------
  const handleMouseEnter = useCallback(() => setIgnoreMouse(false), []);
  const handleMouseLeave = useCallback(() => setIgnoreMouse(true), []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      {/* Hidden measurer for response content height */}
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
        {state === "response" && <ResponseBody response={currentResponse} />}
      </div>

      {/* The pill */}
      <motion.div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={activate}
        animate={{ height: pillHeight }}
        transition={SPRING}
        style={{
          width: "100%",
          background: "#000",
          borderRadius: "0 0 16px 16px",
          overflow: "hidden",
          position: "relative",
          cursor: state === "idle" ? "pointer" : "default",
        }}
      >
        <div style={{ paddingTop: topPad, paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
          {/* Idle state */}
          {state === "idle" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 24 }}>
              <Sparkle active={false} />
            </div>
          )}

          {/* Listening / Thinking / Response */}
          <AnimatePresence mode="wait">
            {state === "listening" && (
              <motion.div
                key="listening"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={CONTENT_ENTER}
                style={{ display: "flex", alignItems: "center", height: 24, gap: 8 }}
              >
                <Sparkle active />
                <span style={{ color: "#fff", fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.01em", flex: 1 }}>
                  Listening...
                </span>
                <Waveform />
              </motion.div>
            )}

            {state === "thinking" && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={CONTENT_ENTER}
                style={{ display: "flex", alignItems: "center", height: 24, gap: 8 }}
              >
                <Sparkle active />
                <ThinkingDots />
              </motion.div>
            )}

            {state === "response" && (
              <motion.div
                key={`response-${responseIdx}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={CONTENT_EXIT}
              >
                {/* Header */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...CONTENT_ENTER, delay: 0 }}
                  style={{ display: "flex", alignItems: "center", height: 24, gap: 8 }}
                >
                  <Sparkle active />
                  <span style={{ color: "#fff", fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em" }}>
                    {currentResponse.title}
                  </span>
                </motion.div>

                {/* Body */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...CONTENT_ENTER, delay: STAGGER_MS / 1000 }}
                  style={{ marginTop: 8, paddingLeft: 22 }}
                >
                  <ResponseBody response={currentResponse} />
                </motion.div>

                {/* Dismiss hint */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.35 }}
                  transition={{ ...CONTENT_ENTER, delay: (STAGGER_MS * 2) / 1000 }}
                  style={{ textAlign: "right", marginTop: 6, fontSize: 11, color: "#fff", letterSpacing: "-0.01em" }}
                >
                  Done
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Subtle bottom edge highlight */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "50%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
          }}
        />
      </motion.div>
    </div>
  );
};
