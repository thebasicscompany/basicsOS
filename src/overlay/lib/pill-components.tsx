import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { MicrophoneIcon } from "@phosphor-icons/react";

export const Sparkle = ({ active }: { active: boolean }) => (
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
        fill="var(--overlay-text-primary)"
        fillOpacity={active ? 1 : 0.55}
      />
    </svg>
  </motion.div>
);

export const PencilIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--overlay-text-primary)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

export const MicIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--overlay-text-primary)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

export const CompanyLogo = () => {
  return (
    <motion.div
      animate={{ opacity: [0.45, 0.75, 0.45] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 15,
        height: 15,
      }}
    >
      <MicrophoneIcon size={13} weight="fill" color="var(--overlay-text-secondary)" />
    </motion.div>
  );
};

export const Waveform = ({ level = 0 }: { level?: number }) => {
  const [heights, setHeights] = useState([2, 2, 2, 2, 2]);
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    const iv = setInterval(() => {
      // Scale the 0–~0.1 RMS range to 0–1; clamp above 0.07 as "loud"
      const scaled = Math.min(1, levelRef.current / 0.065);
      setHeights(
        Array.from({ length: 5 }, () => {
          const base = 2 + scaled * 13;
          return Math.max(2, base * (0.6 + Math.random() * 0.7));
        })
      );
    }, 80);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 16 }}>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          animate={{ height: h }}
          transition={{
            type: "spring",
            stiffness: 600,
            damping: 20,
            mass: 0.3,
          }}
          style={{
            width: 2,
            borderRadius: 1,
            background: "var(--overlay-text-secondary)",
          }}
        />
      ))}
    </div>
  );
};

export const ThinkingDots = () => (
  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          delay: i * 0.2,
          ease: "easeInOut",
        }}
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "var(--overlay-text-primary)",
        }}
      />
    ))}
  </div>
);

export const ResponseBody = ({
  response,
}: {
  response: { title: string; lines: string[] };
}) => (
  <div>
    <div
      style={{
        color: "var(--overlay-text-primary)",
        fontSize: "var(--overlay-font-lg)",
        lineHeight: 1.5,
        fontWeight: 400,
      }}
    >
      {response.lines[0]}
    </div>
    {response.lines.slice(1).map((line, i) => (
      <div
        key={`${response.title}-${i}`}
        style={{
          color: "var(--overlay-text-secondary)",
          fontSize: "var(--overlay-font-md)",
          lineHeight: 1.5,
          marginTop: 2,
        }}
      >
        {line}
      </div>
    ))}
  </div>
);

export const MeetingTimer = ({
  startedAt,
}: {
  startedAt: number | null;
}) => {
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
    <span
      style={{
        color: "var(--overlay-text-muted)",
        fontSize: "var(--overlay-font-sm)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {min}:{sec.toString().padStart(2, "0")}
    </span>
  );
};
