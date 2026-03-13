import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { MicrophoneIcon } from "@phosphor-icons/react";
import { navigateMain } from "./ipc";

/* ── Inline markdown parser ─────────────────────────────────────── */

type InlineSeg =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "link"; label: string; url: string };

// Matches: [label](url), **bold**, *italic*, bare https://… URLs
const INLINE_RE =
  /\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|(https?:\/\/[^\s)]+)/g;

function parseInlineMarkdown(text: string): InlineSeg[] {
  const segs: InlineSeg[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) segs.push({ type: "text", content: text.slice(last, m.index) });
    if (m[1] != null && m[2] != null) {
      // [label](url)
      segs.push({ type: "link", label: m[1], url: m[2] });
    } else if (m[3] != null) {
      // **bold**
      segs.push({ type: "bold", content: m[3] });
    } else if (m[4] != null) {
      // *italic*
      segs.push({ type: "italic", content: m[4] });
    } else if (m[5] != null) {
      // bare URL
      segs.push({ type: "link", label: m[5], url: m[5] });
    }
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) segs.push({ type: "text", content: text.slice(last) });
  if (segs.length === 0) segs.push({ type: "text", content: text });
  return segs;
}

function handleLinkClick(url: string) {
  navigateMain(url);
}

const InlineContent = ({ text }: { text: string }) => {
  const segs = parseInlineMarkdown(text);
  return (
    <>
      {segs.map((seg, i) => {
        switch (seg.type) {
          case "bold":
            return <strong key={i} style={{ fontWeight: 600, color: "#fff" }}>{seg.content}</strong>;
          case "italic":
            return <em key={i}>{seg.content}</em>;
          case "link":
            return (
              <span
                key={i}
                role="link"
                tabIndex={0}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLinkClick(seg.url); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleLinkClick(seg.url); } }}
                style={{ textDecoration: "underline", cursor: "pointer", color: "rgba(140,180,255,0.9)" }}
              >
                {seg.label}
              </span>
            );
          default:
            return <span key={i}>{seg.content}</span>;
        }
      })}
    </>
  );
};

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
        fill="#fff"
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
    stroke="#fff"
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
    stroke="#fff"
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
      <MicrophoneIcon size={13} weight="fill" color="rgba(255,255,255,0.7)" />
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
            background: "rgba(255,255,255,0.7)",
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
          background: "#fff",
        }}
      />
    ))}
  </div>
);

const lineBaseStyle = {
  lineHeight: 1.5 as const,
};

/* ── Block-level markdown: paragraphs + bullet lists ────────────── */

type Block =
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string };

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    // Bullet: "* text", "- text", "• text"  (also handles "* **bold**: …")
    const bulletMatch = trimmed.match(/^(?:[*•-])\s+(.+)/);
    if (bulletMatch) {
      blocks.push({ type: "bullet", text: bulletMatch[1] ?? trimmed });
    } else {
      blocks.push({ type: "paragraph", text: trimmed });
    }
  }
  return blocks;
}

export const ResponseBody = ({
  response,
}: {
  response: { title: string; lines: string[] };
}) => {
  const blocks = parseBlocks(response.lines);
  return (
    <div>
      {blocks.map((block, i) => {
        const isPrimary = i === 0 && block.type === "paragraph";
        const delay = i * 0.06;
        if (block.type === "bullet") {
          return (
            <motion.div
              key={`${response.title}-${i}`}
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.35, delay, ease: "easeOut" }}
              style={{
                ...lineBaseStyle,
                color: "rgba(255,255,255,0.7)",
                fontSize: 12.5,
                marginTop: i === 0 ? 0 : 3,
                display: "flex",
                gap: 6,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>•</span>
              <span><InlineContent text={block.text} /></span>
            </motion.div>
          );
        }
        return (
          <motion.div
            key={`${response.title}-${i}`}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.35, delay, ease: "easeOut" }}
            style={{
              ...lineBaseStyle,
              color: isPrimary ? "#fff" : "rgba(255,255,255,0.7)",
              fontSize: isPrimary ? 13.5 : 12.5,
              marginTop: i === 0 ? 0 : 4,
            }}
          >
            <InlineContent text={block.text} />
          </motion.div>
        );
      })}
    </div>
  );
};

/** Passive notification pill — never auto-listens. Shows title, body, and response options. */
export const NotificationPill = ({
  title,
  body,
  actions,
  assistantShortcutLabel,
  onRespondWithVoice,
  onRespondInChat,
  onDismiss,
}: {
  title: string;
  body: string;
  actions?: Array<{ id: string; label: string; url?: string }>;
  assistantShortcutLabel?: string;
  onRespondWithVoice?: () => void;
  onRespondInChat: (context?: string) => void;
  onDismiss: () => void;
}) => {
  const respondAction = actions?.find(
    (a) => a.id === "respond_in_chat" || a.label.toLowerCase().includes("chat"),
  );
  const viewDealAction = actions?.find(
    (a) => a.id === "view_deal" || a.label.toLowerCase().includes("deal"),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          color: "#fff",
          fontSize: 13.5,
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: "rgba(255,255,255,0.75)",
          fontSize: 12.5,
          lineHeight: 1.5,
        }}
      >
        <InlineContent text={body} />
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginTop: 6,
          paddingBottom: 4,
        }}
      >
        {onRespondWithVoice && assistantShortcutLabel && (
          <button
            type="button"
            onClick={onRespondWithVoice}
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <MicrophoneIcon size={14} weight="fill" />
            Respond with voice ({assistantShortcutLabel})
          </button>
        )}
        <button
          type="button"
          onClick={() => onRespondInChat(respondAction?.url)}
          style={{
            background: "transparent",
            color: "rgba(255,255,255,0.55)",
            border: "none",
            padding: "4px 8px",
            fontSize: 11.5,
            fontWeight: 500,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          {respondAction?.label ?? "Respond in chat"}
        </button>
        {viewDealAction?.url && (
          <button
            type="button"
            onClick={() => navigateMain(viewDealAction!.url!)}
            style={{
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {viewDealAction.label}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: "transparent",
            color: "rgba(255,255,255,0.4)",
            border: "none",
            padding: "4px 8px",
            fontSize: 12,
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

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
        color: "rgba(255,255,255,0.5)",
        fontSize: 11,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {min}:{sec.toString().padStart(2, "0")}
    </span>
  );
};
