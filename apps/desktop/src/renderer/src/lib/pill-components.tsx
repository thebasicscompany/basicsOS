// ---------------------------------------------------------------------------
// Pill sub-components — icons, indicators, and response display
// ---------------------------------------------------------------------------

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------

export const SPRING = { type: "spring" as const, stiffness: 500, damping: 35, mass: 0.8 };
export const CONTENT_ENTER = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };
export const CONTENT_EXIT = { duration: 0.12 };
export const STAGGER_MS = 80;

// ---------------------------------------------------------------------------
// Height constants
// ---------------------------------------------------------------------------

export const IDLE_HEIGHT = 12;
export const ACTIVE_HEIGHT = 48;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

export const Sparkle = ({ active }: { active: boolean }): JSX.Element => (
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

export const PencilIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

export const MicIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

// ---------------------------------------------------------------------------
// Company logo
// ---------------------------------------------------------------------------

export const CompanyLogo = ({ logoUrl }: { logoUrl: string | null }): JSX.Element => {
  if (logoUrl) {
    return (
      <motion.img
        src={logoUrl}
        alt=""
        animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ width: 15, height: 15, borderRadius: 3, objectFit: "contain" }}
      />
    );
  }
  // Default: Basics OS logomark — rounded "b" lettermark
  return (
    <motion.div
      animate={{ opacity: [0.45, 0.75, 0.45] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 15, height: 15 }}
    >
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <rect x="1" y="1" width="18" height="18" rx="5" fill="white" fillOpacity="0.15" />
        <path d="M7 5.5v9M7 10h2.5a2.5 2.5 0 0 0 0-5H7M7 10h3a2.5 2.5 0 0 1 0 5H7"
          stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Animated indicators
// ---------------------------------------------------------------------------

export const Waveform = (): JSX.Element => {
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

export const ThinkingDots = (): JSX.Element => (
  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
    {[0, 1, 2].map((i) => (
      <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
        style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Response display
// ---------------------------------------------------------------------------

export const ResponseBody = ({ response }: { response: { title: string; lines: string[] } }): JSX.Element => (
  <div>
    <div style={{ color: "#fff", fontSize: 13.5, lineHeight: 1.5, fontWeight: 400 }}>{response.lines[0]}</div>
    {response.lines.slice(1).map((line, i) => (
      <div key={`${response.title}-${i}`} style={{ color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.5, marginTop: 2 }}>{line}</div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Meeting timer
// ---------------------------------------------------------------------------

export const MeetingTimer = ({ startedAt }: { startedAt: number | null }): JSX.Element | null => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const iv = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(iv);
  }, [startedAt]);
  if (!startedAt) return null;
  const totalSec = Math.floor(elapsed / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return (
    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
      {min}:{sec.toString().padStart(2, "0")}
    </span>
  );
};
