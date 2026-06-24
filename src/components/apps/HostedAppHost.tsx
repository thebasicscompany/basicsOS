import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { callAppTool, listAppTools, BrokerCallError } from "@/lib/app-broker";
import {
  BRIDGE_VERSION,
  HOST_API_VERSION,
  HOST_EVENTS,
  isAcceptableOrigin,
  isValidBridgeRequest,
  sanitizeNavPath,
  type BridgeEvent,
  type BridgeRequest,
  type ThemeTokens,
} from "@/lib/apps/bridge-protocol";
import type { AppConfig, HostedSpec } from "@/types/apps";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AppContextResponse {
  user: { id: string; name: string; roles: string[] };
  orgId: string;
  grantedPermissions: string[];
}

interface ConfirmState {
  title: string;
  message: string;
  resolve: (confirmed: boolean) => void;
}

function makeNonce(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for environments without randomUUID; nonce only needs to be
    // unguessable-enough to gate a same-page handshake.
    return `n-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
}

// The host's theme vars are oklch values behind var() chains, so we must RESOLVE
// them to concrete colors (a sandboxed iframe can't inherit host CSS). For each
// token we read the COMPUTED color of a probe element styled `color: var(--x)`,
// which yields the final used value the app can apply to its own :root.
const THEME_VARS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--border",
  "--input",
  "--ring",
];

function readThemeTokens(mode: "light" | "dark"): ThemeTokens {
  const tokens: Record<string, string> = {};
  try {
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    document.body.appendChild(probe);
    for (const name of THEME_VARS) {
      probe.style.color = `var(${name})`;
      const v = getComputedStyle(probe).color;
      if (v) tokens[name] = v;
    }
    probe.remove();
    const rootCs = getComputedStyle(document.documentElement);
    tokens["--radius"] = rootCs.getPropertyValue("--radius").trim() || "0.5rem";
    tokens["--app-font"] = getComputedStyle(document.body).fontFamily || "ui-sans-serif, system-ui, sans-serif";
  } catch {
    /* SSR / no DOM */
  }
  return { mode, tokens };
}

/** Bridge error with a stable code surfaced to the app. */
class BridgeError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Runtime host for a HOSTED custom app (APP-4a + APP-4b).
 *
 * Isolation (the trust boundary — see bridge-protocol.ts for the full model):
 *  - <iframe sandbox="allow-scripts"> with NO allow-same-origin → the app runs at an
 *    opaque origin and cannot read host cookies, storage, or DOM.
 *  - The bridge (postMessage) is the only channel. Every inbound message is checked:
 *    event.source must be THIS iframe's contentWindow (unspoofable), the origin must
 *    be acceptable, and the app must have completed the nonce handshake.
 *  - No secrets ever cross the bridge; tools.* run server-side, gated to the app's
 *    grants AND the acting user's RBAC.
 */
export function HostedAppHost({ app }: { app: AppConfig }) {
  const spec = app.spec as HostedSpec;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const mode: "light" | "dark" = resolvedTheme === "dark" ? "dark" : "light";

  const nonceRef = useRef<string>(makeNonce());
  const readyRef = useRef(false);
  const initializedRef = useRef(false); // host:init sent exactly once (first load)
  const loadedOnceRef = useRef(false); // the iframe's first document has loaded
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const { data: context } = useQuery<AppContextResponse>({
    queryKey: ["app-context", app.slug],
    queryFn: () => fetchApi<AppContextResponse>(`/api/apps/${encodeURIComponent(app.slug)}/context`),
  });

  // Latest values read inside the (stable) message handler, via refs.
  const contextRef = useRef<AppContextResponse | null>(null);
  const modeRef = useRef(mode);
  contextRef.current = context ?? null;
  modeRef.current = mode;

  const askConfirm = useCallback(
    (title: string, message: string) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ title, message, resolve });
      }),
    [],
  );

  const dispatch = useCallback(
    async (method: string, params: unknown): Promise<unknown> => {
      const ctx = contextRef.current;
      const p = (params ?? {}) as Record<string, unknown>;
      switch (method) {
        case "tools.list":
          return { tools: await listAppTools(app.slug) };
        case "tools.call": {
          const name = p.name;
          if (typeof name !== "string") throw new BridgeError("BAD_REQUEST", "tools.call needs a name");
          try {
            return await callAppTool(app.slug, name, (p.params ?? p.arguments ?? {}) as Record<string, unknown>);
          } catch (e) {
            if (e instanceof BrokerCallError) throw new BridgeError(e.code ?? "UPSTREAM", e.message);
            throw e;
          }
        }
        case "auth.session":
          if (!ctx) throw new BridgeError("UPSTREAM", "context unavailable");
          return { userId: ctx.user.id, orgId: ctx.orgId, roles: ctx.user.roles, displayName: ctx.user.name };
        case "nav.go": {
          const path = sanitizeNavPath(p.path);
          if (!path) throw new BridgeError("BAD_REQUEST", "unsafe or non-internal path");
          navigate(path);
          return null;
        }
        case "nav.openRecord": {
          const object = p.object;
          const id = p.id;
          if (typeof object !== "string" || !/^[a-z0-9_]+$/i.test(object)) {
            throw new BridgeError("BAD_REQUEST", "invalid object");
          }
          if (typeof id !== "string" && typeof id !== "number") {
            throw new BridgeError("BAD_REQUEST", "invalid id");
          }
          navigate(`/objects/${object}/${encodeURIComponent(String(id))}`);
          return null;
        }
        case "ui.toast": {
          const kind = p.kind === "success" || p.kind === "error" || p.kind === "info" ? p.kind : "info";
          const message = typeof p.message === "string" ? p.message : "";
          if (kind === "success") toast.success(message);
          else if (kind === "error") toast.error(message);
          else toast(message);
          return null;
        }
        case "ui.confirm": {
          const title = typeof p.title === "string" ? p.title : "Confirm";
          const message = typeof p.message === "string" ? p.message : "";
          return { confirmed: await askConfirm(title, message) };
        }
        case "theme.get":
          return readThemeTokens(modeRef.current);
        case "storage.get": {
          const key = typeof p.key === "string" ? p.key : "";
          const scope = p.scope === "user" ? "user" : "app";
          if (!key) throw new BridgeError("BAD_REQUEST", "storage.get needs a key");
          const r = await fetchApi<{ value: unknown }>(
            `/api/apps/${encodeURIComponent(app.slug)}/storage?key=${encodeURIComponent(key)}&scope=${scope}`,
          );
          return r.value;
        }
        case "storage.set": {
          const key = typeof p.key === "string" ? p.key : "";
          const scope = p.scope === "user" ? "user" : "app";
          if (!key) throw new BridgeError("BAD_REQUEST", "storage.set needs a key");
          await fetchApi(`/api/apps/${encodeURIComponent(app.slug)}/storage`, {
            method: "PUT",
            body: JSON.stringify({ key, value: p.value ?? null, scope }),
          });
          return null;
        }
        case "agent.invoke": {
          const prompt = typeof p.prompt === "string" ? p.prompt : "";
          if (!prompt) throw new BridgeError("BAD_REQUEST", "agent.invoke needs a prompt");
          return await fetchApi<{ text: string }>(`/api/apps/${encodeURIComponent(app.slug)}/agent`, {
            method: "POST",
            body: JSON.stringify({ prompt, context: p.context }),
          });
        }
        default:
          throw new BridgeError("UNKNOWN_METHOD", `Unknown method: ${method}`);
      }
    },
    [app.slug, navigate, askConfirm],
  );

  // Stable message handler (reads live state via refs). Registered once.
  useEffect(() => {
    const respond = (frame: Window, id: string, ok: boolean, payload: unknown) => {
      const body = ok
        ? { v: BRIDGE_VERSION, id, ok: true, result: payload }
        : { v: BRIDGE_VERSION, id, ok: false, error: payload };
      // Opaque-origin frame → targetOrigin must be "*"; we never send secrets.
      frame.postMessage(body, "*");
    };

    const handler = async (event: MessageEvent) => {
      const frame = iframeRef.current?.contentWindow;
      // FRAME AUTH: only the exact embedded window, with an acceptable origin.
      if (!frame || event.source !== frame) return;
      if (!isAcceptableOrigin(event.origin, spec.origin)) return;

      const msg = event.data as { event?: string; data?: { nonce?: string } };
      // Handshake completion.
      if (msg?.event === "app:ready") {
        if (msg.data?.nonce === nonceRef.current) readyRef.current = true;
        return;
      }
      if (!isValidBridgeRequest(msg)) return;
      const req = msg as unknown as BridgeRequest;
      if (!readyRef.current) {
        respond(frame, req.id, false, { code: "NOT_READY", message: "Handshake not complete." });
        return;
      }
      // A method may await network I/O; if the app navigates its frame mid-call,
      // the captured `frame` WindowProxy would now host an attacker document. Only
      // deliver the result if the SAME original document is still resident and the
      // handshake is still valid — else drop it (no data leak to a navigated frame).
      const stillOriginalFrame = () =>
        iframeRef.current?.contentWindow === frame && readyRef.current;
      try {
        const result = await dispatch(req.method, req.params);
        if (stillOriginalFrame()) respond(frame, req.id, true, result);
      } catch (e) {
        const code = e instanceof BridgeError ? e.code : "UPSTREAM";
        const message = e instanceof Error ? e.message : "error";
        if (stillOriginalFrame()) respond(frame, req.id, false, { code, message });
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [spec.origin, dispatch]);

  // Send host:init EXACTLY ONCE, on the iframe's first document load, once we have
  // context. It carries NO identity (just nonce + theme) — identity is delivered
  // only as a reply to a post-handshake auth.session. We never re-init: if the app
  // navigates its frame (a new onLoad), we invalidate the handshake and stay silent,
  // so a navigated-away/attacker document can't drive the bridge or harvest a nonce.
  const tryInit = useCallback(() => {
    const frame = iframeRef.current?.contentWindow;
    if (initializedRef.current || !frame || !context || !loadedOnceRef.current) return;
    initializedRef.current = true;
    nonceRef.current = makeNonce();
    readyRef.current = false;
    const init: BridgeEvent = {
      v: BRIDGE_VERSION,
      event: HOST_EVENTS.init,
      data: {
        appId: app.slug,
        appVersion: app.version,
        hostApiVersion: HOST_API_VERSION,
        nonce: nonceRef.current,
        theme: readThemeTokens(mode),
      },
    };
    frame.postMessage(init, "*");
  }, [app.slug, app.version, context, mode]);

  const onIframeLoad = useCallback(() => {
    if (!loadedOnceRef.current) {
      loadedOnceRef.current = true;
      tryInit();
    } else {
      // Subsequent load = an app-initiated navigation. Invalidate the handshake and
      // do NOT re-init: the new document can never complete a handshake, so every
      // request from it answers NOT_READY.
      readyRef.current = false;
    }
  }, [tryInit]);

  // Init once context arrives (if the first load already happened).
  useEffect(() => {
    if (context) tryInit();
  }, [context, tryInit]);

  // Notify the app of theme changes (only after handshake).
  useEffect(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame || !readyRef.current) return;
    const ev: BridgeEvent = {
      v: BRIDGE_VERSION,
      event: HOST_EVENTS.themeChanged,
      data: readThemeTokens(mode),
    };
    frame.postMessage(ev, "*");
  }, [mode]);

  return (
    <div className="h-full min-h-[480px] w-full">
      <iframe
        ref={iframeRef}
        src={spec.entryUrl}
        // SECURITY: allow-scripts ONLY. No allow-same-origin → opaque origin, so the
        // app can't reach host cookies/storage/DOM. Do not add allow-same-origin.
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        onLoad={onIframeLoad}
        className="h-full w-full border-0"
        title={app.name}
      />

      <Dialog open={!!confirmState} onOpenChange={(o) => { if (!o) { confirmState?.resolve(false); setConfirmState(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmState?.title}</DialogTitle>
            <DialogDescription>{confirmState?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                confirmState?.resolve(false);
                setConfirmState(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                confirmState?.resolve(true);
                setConfirmState(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
