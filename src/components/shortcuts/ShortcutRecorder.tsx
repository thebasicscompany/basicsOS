function KeyBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-[0_1px_0_0_rgba(0,0,0,0.3)] min-w-[1.4rem] leading-none">
      {label}
    </span>
  );
}

export function ShortcutRow({
  label,
  description,
  value,
  onRecord,
  isRecording,
  liveKeys,
  onCancel,
}: {
  label: string;
  description: string;
  value: string;
  onRecord: () => void;
  isRecording?: boolean;
  liveKeys?: string;
  onCancel?: () => void;
}) {
  if (isRecording) {
    const keyParts = liveKeys ? liveKeys.split("+").filter(Boolean) : [];
    return (
      <li className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">
            Hold keys, then release to set. <kbd className="text-[10px] opacity-60">Esc</kbd> to cancel.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex min-w-[140px] items-center gap-1 rounded-lg border border-primary bg-primary/5 px-2.5 py-1.5">
            {keyParts.length > 0 ? (
              keyParts.map((k, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 ? <span className="text-[10px] text-muted-foreground">+</span> : null}
                  <KeyBadge label={k} />
                </span>
              ))
            ) : (
              <span className="text-xs text-primary/70 animate-pulse select-none">Press keys…</span>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Cancel"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <button
        type="button"
        onClick={onRecord}
        className="shrink-0 min-w-[100px] rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-mono font-medium text-foreground hover:bg-muted hover:border-primary/50 transition-colors cursor-pointer text-center"
        title="Click to change shortcut"
      >
        {value}
      </button>
    </li>
  );
}
