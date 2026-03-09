import type React from "react";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SyncedEmail } from "@/types/email-sync";

interface EmailViewDialogProps {
  email: SyncedEmail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Parsing utilities ──────────────────────────────────────────────

/** Strip all leading > characters from a line */
function stripQuotePrefix(line: string): string {
  return line.replace(/^(?:>\s*)+/, "");
}

/** Check if line (or joined line) is a quote attribution */
function isAttribution(line: string): boolean {
  const clean = stripQuotePrefix(line).trim();
  // "On Thu, Feb 19, 2026 at 7:13 PM Name wrote:"
  if (/^On .+wrote:\s*$/i.test(clean)) return true;
  // "Feb 20, 2026 at 1:47 AM, Name wrote:"
  if (
    /^\w+ \d+,?\s+\d{4}\s+at\s+[\d:]+\s*(?:AM|PM)?,?\s+.+wrote:\s*$/i.test(
      clean,
    )
  )
    return true;
  return false;
}

/** Check if this line starts an attribution that may continue on the next line */
function isAttributionStart(line: string): boolean {
  const clean = stripQuotePrefix(line).trim();
  // "On Thu, Feb 19, 2026 at 7:13 PM Giuseppe Stuto <email>"  (no "wrote:" yet)
  return /^On \w+,\s+\w+ \d+/i.test(clean) && !clean.includes("wrote:");
}

/**
 * Pre-process lines to join multi-line attributions.
 * e.g. "On Thu, ..., Giuseppe Stuto <email>\n wrote:" → single line
 */
function joinMultiLineAttributions(lines: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      isAttributionStart(line) &&
      i + 1 < lines.length &&
      /^\s*wrote:\s*$/i.test(stripQuotePrefix(lines[i + 1]).trim())
    ) {
      // Join this line with the next "wrote:" line
      result.push(line + " " + lines[i + 1].trim());
      i++; // skip next line
    } else {
      result.push(line);
    }
  }
  return result;
}

/** Strip signatures, "Sent via" lines, URLs in angle brackets */
function cleanText(text: string): string {
  let c = text;
  c = c.replace(/\nSent via .+$/gim, "");
  c = c.replace(/\nSent from .+$/gim, "");
  c = c.replace(/\nGet Outlook .+$/gim, "");
  c = c.replace(/\n--\s*\n[\s\S]*$/, "");
  c = c.replace(/\n_{3,}\n[\s\S]*$/, "");
  c = c.replace(/<https?:\/\/[^>]+>/g, "");
  c = c.replace(/\nhttps?:\/\/\S+$/gm, "");
  // Trailing Name\nCompany block
  c = c.replace(/\n+[A-Z][a-zA-Z]+ [A-Z][a-zA-Z]+\n[A-Z][A-Za-z\s]+\s*$/, "");
  // Trailing sign-off
  c = c.replace(
    /\n+(?:Cheers|Best|Thanks|Regards|Best regards),?\n[\w\s]+\s*$/,
    "",
  );
  return c.trim();
}

// ── Thread structure ───────────────────────────────────────────────

interface ThreadMessage {
  attribution: string;
  body: string;
  children: ThreadMessage[];
}

/**
 * Recursively split text on attribution lines.
 * Returns the text before the first attribution (the "own" body)
 * and an array of child messages for each attribution found.
 */
function splitOnAttributions(text: string): {
  ownBody: string;
  children: ThreadMessage[];
} {
  const lines = joinMultiLineAttributions(text.split("\n"));
  const ownLines: string[] = [];
  const children: ThreadMessage[] = [];

  let i = 0;

  // Collect lines before first attribution or `>` quote prefix
  while (i < lines.length) {
    const line = lines[i];
    if (isAttribution(line) || /^>\s/.test(line)) break;
    ownLines.push(line);
    i++;
  }

  // Split remaining on attribution boundaries
  let curAttribution = "";
  let curBody: string[] = [];

  const flush = () => {
    const raw = curBody.map(stripQuotePrefix).join("\n").trim();
    if (raw || curAttribution) {
      const cleaned = cleanText(raw);
      // Recursively parse the body for deeper attributions
      const { ownBody, children: nested } = splitOnAttributions(cleaned);
      children.push({
        attribution: curAttribution,
        body: ownBody,
        children: nested,
      });
    }
    curAttribution = "";
    curBody = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    if (isAttribution(line)) {
      flush();
      curAttribution = stripQuotePrefix(line).trim();
    } else {
      curBody.push(line);
    }
    i++;
  }
  flush();

  return {
    ownBody: cleanText(ownLines.join("\n").trim()),
    children,
  };
}

/** Parse a full email body into a thread tree */
function parseEmailThread(rawBody: string): {
  latest: string;
  replies: ThreadMessage[];
} {
  const normalized = rawBody.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const { ownBody, children } = splitOnAttributions(normalized);
  return { latest: ownBody, replies: children };
}

// ── Display helpers ────────────────────────────────────────────────

function extractSenderName(attribution: string): string | null {
  const onMatch = attribution.match(
    /On .+?,\s*(.+?)\s*(?:<.*>)?\s*wrote:/i,
  );
  if (onMatch?.[1]) return onMatch[1].trim();
  const dateFirstMatch = attribution.match(
    /\d{4}\s+at\s+[\d:]+\s*(?:AM|PM)?,?\s+(.+?)\s*(?:<.*>)?\s*wrote:/i,
  );
  return dateFirstMatch?.[1]?.trim() ?? null;
}

function extractDate(attribution: string): string | null {
  const onDate = attribution.match(/On\s+\w+,\s+(\w+ \d+,?\s+\d{4})/i);
  if (onDate) return onDate[1];
  const dateFirst = attribution.match(/^(\w+ \d+,?\s+\d{4})\s+at/i);
  return dateFirst?.[1] ?? null;
}

// ── Components ─────────────────────────────────────────────────────

/** Render a line, turning URLs into clickable links */
function renderLine(line: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s<>]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    const url = match[1];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80"
      >
        {url.length > 60 ? url.slice(0, 57) + "..." : url}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [line];
}

/** Check if a line is just a separator (lone dash, em-dash, underscore, etc.) */
function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  return /^[-–—_*]{1,3}$/.test(trimmed);
}

function EmailBody({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => {
        if (!p.trim()) return null;
        const lines = p.split("\n");
        return (
          <div key={i} className="text-sm leading-relaxed">
            {lines.map((line, j) => {
              if (isSeparatorLine(line)) {
                return <div key={j} className="my-1.5 h-px" />;
              }
              return (
                <p key={j} className={j > 0 ? "mt-0.5" : ""}>
                  {renderLine(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ThreadReply({
  msg,
  depth,
}: {
  msg: ThreadMessage;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const senderName = extractSenderName(msg.attribution);
  const dateStr = extractDate(msg.attribution);

  if (!msg.body.trim() && !msg.attribution && msg.children.length === 0)
    return null;

  // First line of body as preview when collapsed
  const preview = msg.body.split("\n").find((l) => l.trim())?.trim() ?? "";
  const hasContent = !!(msg.body.trim() || msg.children.length > 0);

  return (
    <div className="mt-2" style={{ marginLeft: depth * 16 }}>
      {/* Collapsible header — looks like a clickable card when collapsed */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
          expanded
            ? "bg-muted/30 text-muted-foreground"
            : "border border-border/60 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40"
        }`}
      >
        {/* Expand/collapse icon */}
        <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded text-[10px]">
          {expanded ? "▾" : "▸"}
        </span>

        <div className="min-w-0 flex-1">
          {/* Sender + date */}
          <div className="flex items-baseline gap-2">
            {senderName ? (
              <span className="font-semibold text-foreground/80">
                {senderName}
              </span>
            ) : (
              <span className="font-medium text-muted-foreground/70">
                {msg.attribution || "Quoted text"}
              </span>
            )}
            {dateStr && (
              <span className="text-[11px] text-muted-foreground/50">
                {dateStr}
              </span>
            )}
          </div>

          {/* Preview snippet when collapsed */}
          {!expanded && preview && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/50">
              {preview.slice(0, 120)}
              {preview.length > 120 ? "..." : ""}
            </p>
          )}

          {/* Child count badge when collapsed */}
          {!expanded && msg.children.length > 0 && (
            <span className="mt-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground/60">
              +{msg.children.length} earlier{" "}
              {msg.children.length === 1 ? "reply" : "replies"}
            </span>
          )}
        </div>

        {/* Explicit show/hide label */}
        {hasContent && (
          <span className="mt-0.5 shrink-0 text-[10px] font-medium text-muted-foreground/40">
            {expanded ? "Hide" : "Show"}
          </span>
        )}
      </button>

      {/* Expanded body + nested replies */}
      {expanded && (
        <div className="mt-2 border-l-2 border-muted-foreground/15 pl-4">
          {msg.body && (
            <div className="text-muted-foreground/80">
              <EmailBody text={msg.body} />
            </div>
          )}
          {msg.children.map((child, i) => (
            <ThreadReply key={i} msg={child} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main dialog ────────────────────────────────────────────────────

export function EmailViewDialog({
  email,
  open,
  onOpenChange,
}: EmailViewDialogProps) {
  const parsed = useMemo(() => {
    if (!email) return null;
    const raw = email.bodyText ?? email.snippet ?? "";
    return parseEmailThread(raw);
  }, [email]);

  if (!email || !parsed) return null;

  const fromName = email.fromName ?? email.fromEmail;
  const initials = fromName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const toList = (email.toAddresses ?? [])
    .map((t) => t.name ?? t.email)
    .join(", ");
  const ccList = (email.ccAddresses ?? [])
    .map((t) => t.name ?? t.email)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
        {/* Header */}
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-base font-semibold leading-snug">
            {email.subject ?? "(no subject)"}
          </DialogTitle>
        </DialogHeader>

        {/* Sender info */}
        <div className="border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">{fromName}</span>
                <span className="text-xs text-muted-foreground">
                  &lt;{email.fromEmail}&gt;
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>To: {toList}</span>
                {ccList && <span>Cc: {ccList}</span>}
              </div>
            </div>
            <div className="shrink-0 text-xs text-muted-foreground">
              {format(new Date(email.date), "MMM d, yyyy 'at' h:mm a")}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Latest message */}
          {parsed.latest && (
            <div className="text-foreground">
              <EmailBody text={parsed.latest} />
            </div>
          )}

          {/* Thread replies */}
          {parsed.replies.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
                Earlier in this thread
              </p>
              {parsed.replies.map((msg, i) => (
                <ThreadReply key={i} msg={msg} depth={i} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
