import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { getRuntimeApiUrl } from "@/lib/runtime-config";
import type { AppConfig } from "@/types/apps";

export interface BuildPlan {
  kind: "declarative" | "hosted";
  name: string;
  summary?: string;
  screens?: string[];
  tools: string[];
  notes?: string;
}

export type BuilderEvent =
  | { type: "phase"; phase: "planning" | "building" | "refining"; label: string }
  | { type: "plan"; plan: BuildPlan }
  | { type: "done"; kind: "declarative" | "hosted"; app: AppConfig; plan: BuildPlan }
  | { type: "error"; error: string; raw?: string; detail?: string };

/**
 * Run the deliberate, multi-phase builder and stream its phases (plan → build →
 * review) to `onEvent`, so the UI shows the work happening. Resolves when the
 * stream ends. The server creates/updates the DRAFT app and returns it in the
 * `done` event for sandboxed preview before publish.
 */
export async function runBuilderStream(
  payload: { prompt: string; slug?: string },
  onEvent: (e: BuilderEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${getRuntimeApiUrl()}/api/app-config/builder`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = `Builder request failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    onEvent({ type: "error", error: msg });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // SSE frames are separated by a blank line; each frame has `data:` lines.
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      for (const line of frame.split("\n")) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (!data) continue;
        try {
          onEvent(JSON.parse(data) as BuilderEvent);
        } catch {
          /* ignore keepalive/partial */
        }
      }
    }
  }
}

export interface PublishResult {
  ok: boolean;
  status: AppConfig["status"];
  app?: AppConfig;
  scan: { risk: "low" | "medium" | "high"; reasons: string[]; summary: string; source: string };
}

/** Scan + activate an app (POST /api/app-config/:slug/publish). */
export function usePublishApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) =>
      fetchApi<PublishResult>(`/api/app-config/${slug}/publish`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-config"] });
    },
  });
}
