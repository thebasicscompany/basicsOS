import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UpdateState =
  | { status: "idle" }
  | { status: "available"; version: string }
  | { status: "downloading"; version: string; percent: number }
  | { status: "ready"; version: string };

export function AppUpdateBanner() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const isElectron = import.meta.env.VITE_IS_ELECTRON;
  const updater = typeof window !== "undefined" ? window.electronAPI?.updater : undefined;

  useEffect(() => {
    if (!isElectron || !updater) return;

    updater.onUpdateAvailable((info) => {
      setState({ status: "available", version: info.version });
    });
    updater.onUpdateProgress((progress) => {
      setState((prev) =>
        prev.status === "available" || prev.status === "downloading"
          ? { status: "downloading", version: prev.version, percent: progress.percent ?? 0 }
          : prev.status === "idle"
            ? { status: "downloading", version: "?", percent: progress.percent ?? 0 }
            : prev,
      );
    });
    updater.onUpdateDownloaded(() => {
      setState((prev) =>
        prev.status !== "idle"
          ? { status: "ready", version: prev.version }
          : { status: "ready", version: "?" },
      );
    });
  }, [isElectron, updater]);

  const handleRestart = () => {
    window.electronAPI?.updater?.installUpdate?.();
  };

  if (state.status === "idle") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex shrink-0 items-center gap-3 border-b border-border bg-surface-card px-4 py-2 text-sm",
      )}
    >
      {state.status === "downloading" && (
        <>
          <span className="text-muted-foreground">Updating…</span>
          <Progress value={state.percent} className="h-2 w-32" />
          <span className="text-muted-foreground tabular-nums">{Math.round(state.percent)}%</span>
        </>
      )}
      {state.status === "ready" && (
        <>
          <span className="text-muted-foreground">
            Update ready (v{state.version}). Restart to apply.
          </span>
          <Button size="sm" variant="default" onClick={handleRestart}>
            Restart now
          </Button>
        </>
      )}
      {state.status === "available" && (
        <span className="text-muted-foreground">Downloading update…</span>
      )}
    </div>
  );
}
