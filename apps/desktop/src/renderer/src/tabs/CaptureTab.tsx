import { useState } from "react";
import { Camera, Loader2, Sparkles, CheckCircle, ArrowRight, Input, Button, Label } from "@basicsos/ui";
import { trpcCall } from "../api";
import { getIPC, sendIPC } from "../lib/ipc";

export const CaptureTab = (): JSX.Element => {
  const [status, setStatus] = useState<"idle" | "capturing" | "analyzing" | "done" | "error">(
    "idle",
  );
  const [result, setResult] = useState<{ id: string; title: string; analysis: string } | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("Captured Workflow");

  const handleCapture = async (): Promise<void> => {
    const ipc = getIPC();
    if (!ipc?.captureScreen) {
      setErrorMsg("Screen capture requires the Electron desktop app.");
      setStatus("error");
      return;
    }

    setStatus("capturing");
    setResult(null);
    setErrorMsg(null);

    try {
      const base64 = await ipc.captureScreen();
      setStatus("analyzing");
      const doc = await trpcCall<{ id: string; title: string; analysis: string }>(
        "knowledge.createFromCapture",
        { imageBase64: base64, title: customTitle.trim() || "Captured Workflow" },
      );
      setResult(doc);
      setStatus("done");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Capture failed");
      setStatus("error");
    }
  };

  const StatusIcon = status === "capturing" ? Loader2
    : status === "analyzing" ? Sparkles
    : status === "done" ? CheckCircle
    : Camera;

  return (
    <div className="px-4 pb-4 space-y-3">
      <div className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">Workflow Capture</div>
      <p className="text-xs text-stone-400 leading-relaxed">
        Take a screenshot of your current workflow. Claude will describe what&apos;s happening and
        save it to your Knowledge Base.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-stone-500">Document title</Label>
        <Input
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          className="rounded-xl shadow-sm"
          placeholder="Captured Workflow"
        />
      </div>

      <Button
        onClick={() => void handleCapture()}
        disabled={status === "capturing" || status === "analyzing"}
        className="w-full rounded-xl py-3 h-auto shadow-sm gap-2"
      >
        <StatusIcon size={16} className={status === "capturing" ? "animate-spin" : status === "analyzing" ? "animate-pulse" : ""} />
        {status === "idle" || status === "done" || status === "error"
          ? "Capture Screen Now"
          : status === "capturing"
            ? "Capturing..."
            : "Analyzing with Claude..."}
      </Button>

      {status === "done" && result && (
        <div className="rounded-xl bg-white border border-stone-200 p-3 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <CheckCircle size={12} /> Saved to Knowledge Base
            </span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs gap-1"
              onClick={() => sendIPC("navigate-main", "/knowledge")}
            >
              View <ArrowRight size={10} />
            </Button>
          </div>
          <p className="text-xs text-stone-500 line-clamp-4">{result.analysis}</p>
        </div>
      )}

      {status === "error" && errorMsg && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
