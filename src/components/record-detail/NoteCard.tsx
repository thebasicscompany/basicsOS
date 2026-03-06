import { format } from "date-fns";

interface NoteCardProps {
  title: string | null;
  text: string | null;
  date: string;
  onClick: () => void;
}

function truncate(str: string, len: number): string {
  if (!str) return "";
  return str.length <= len ? str : str.slice(0, len) + "\u2026";
}

function stripMarkdown(str: string): string {
  return str
    .replace(/#{1,6}\s/g, "")
    .replace(/[*_~`>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-+]\s/gm, "")
    .replace(/^\d+\.\s/gm, "")
    .replace(/\n{2,}/g, " · ")
    .replace(/\n/g, " ")
    .trim();
}

export function NoteCard({ title, text, date, onClick }: NoteCardProps) {
  const displayTitle = title?.trim() || "Untitled note";
  const cleaned = stripMarkdown(text ?? "");
  const preview = truncate(cleaned, 180);

  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-all hover:border-border/80 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
          {displayTitle}
        </h3>
        <span className="shrink-0 text-xs text-muted-foreground">
          {format(new Date(date), "MMM d, yyyy")}
        </span>
      </div>
      {preview && (
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {preview}
        </p>
      )}
    </button>
  );
}
