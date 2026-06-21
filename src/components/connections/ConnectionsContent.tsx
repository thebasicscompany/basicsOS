"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { CheckCircleIcon, MagnifyingGlassIcon, PlugIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getRuntimeApiUrl } from "@/lib/runtime-config";
const API_URL = getRuntimeApiUrl();

interface CatalogApp {
  app: string;
  name: string;
  connections?: number;
}
interface ConnectedApp {
  app: string;
  status: string;
  scope: "user" | "org";
}

const logoFor = (slug: string) => `https://logos.composio.dev/api/${slug}`;

function AppLogo({ slug, name }: { slug: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-[13px] font-semibold text-muted-foreground">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={logoFor(slug)}
      alt=""
      className="size-8 shrink-0 rounded-md bg-white object-contain p-0.5"
      onError={() => setFailed(true)}
    />
  );
}

export function ConnectionsContent({
  compact,
}: {
  compact?: boolean;
  embeddedInSettings?: boolean;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const { data: catalog = [], isLoading: catalogLoading } = useQuery<CatalogApp[]>({
    queryKey: ["composio-catalog"],
    queryFn: () =>
      fetch(`${API_URL}/api/connections/catalog`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : { apps: [] }))
        .then((d) => d.apps ?? []),
  });

  const { data: connected = [] } = useQuery<ConnectedApp[]>({
    queryKey: ["composio-status"],
    queryFn: () =>
      fetch(`${API_URL}/api/connections/status`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : { apps: [] }))
        .then((d) => d.apps ?? []),
  });

  const connectedMap = useMemo(() => {
    const m = new Map<string, ConnectedApp>();
    for (const c of connected) if (!m.has(c.app) || c.scope === "user") m.set(c.app, c);
    return m;
  }, [connected]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState<string | null>(null);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleConnect = async (app: string, name: string) => {
    try {
      setConnecting(app);
      const res = await fetch(`${API_URL}/api/connections/${app}/connect`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed" }));
        toast.error(data.error ?? "Couldn't start the connection");
        setConnecting(null);
        return;
      }
      const { url } = await res.json();
      window.open(url, "_blank");
      toast.info(`Authorize ${name} in your browser, then come back.`);

      if (pollRef.current) clearInterval(pollRef.current);
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        if (++attempts > 60) { if (pollRef.current) clearInterval(pollRef.current); setConnecting(null); return; }
        try {
          const r = await fetch(`${API_URL}/api/connections/status`, { credentials: "include" });
          if (!r.ok) return;
          const { apps = [] } = await r.json();
          if (apps.some((a: ConnectedApp) => a.app === app)) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setConnecting(null);
            queryClient.invalidateQueries({ queryKey: ["composio-status"] });
            setJustConnected(name);
          }
        } catch { /* ignore */ }
      }, 2000);
    } catch (err) {
      setConnecting(null);
      showError(err, "Couldn't connect");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? catalog.filter((a) => a.name.toLowerCase().includes(q) || a.app.includes(q))
      : catalog;
    // connected first, then catalog order (featured-first from the API)
    return [...list].sort((a, b) => Number(connectedMap.has(b.app)) - Number(connectedMap.has(a.app)));
  }, [catalog, query, connectedMap]);

  const visible = compact ? filtered.filter((a) => connectedMap.has(a.app)).slice(0, 6) : filtered;

  return (
    <>
      <Dialog open={!!justConnected} onOpenChange={(o) => !o && setJustConnected(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                <CheckCircleIcon weight="fill" className="size-5" />
              </div>
              <DialogTitle>{justConnected} connected</DialogTitle>
            </div>
            <DialogDescription>
              Your agent can now use {justConnected} on your behalf — in chat and automations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setJustConnected(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className={compact ? "px-3 py-2" : "flex h-full flex-col py-4"}>
        {!compact && (
          <div className="relative mb-4 max-w-md">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search apps to connect…"
              className="pl-9"
            />
          </div>
        )}

        {catalogLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-[--surface-card-radius] bg-surface-card" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-[--surface-card-radius] border border-dashed py-12 text-center">
            <PlugIcon className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">{compact ? "No apps connected yet" : "No apps found"}</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {compact ? "Connect Gmail, Slack, and more in Settings → Connections." : "Try a different search."}
            </p>
          </div>
        ) : (
          <div className={compact ? "space-y-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
            {visible.map((appItem) => {
              const conn = connectedMap.get(appItem.app);
              const isConnecting = connecting === appItem.app;
              return (
                <div
                  key={appItem.app}
                  className="flex items-center gap-3 rounded-[--surface-card-radius] border bg-surface-card p-3 transition-colors hover:bg-surface-hover"
                >
                  <AppLogo slug={appItem.app} name={appItem.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{appItem.name}</p>
                    {conn ? (
                      <Badge variant="secondary" className="mt-0.5 gap-1 text-[10px]">
                        <span className="size-1.5 rounded-full bg-green-500" />
                        {conn.scope === "org" ? "Shared" : "Connected"}
                      </Badge>
                    ) : (
                      <p className="truncate text-[11px] text-muted-foreground">Not connected</p>
                    )}
                  </div>
                  {!conn && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 text-[12px]"
                      onClick={() => handleConnect(appItem.app, appItem.name)}
                      disabled={isConnecting}
                    >
                      {isConnecting ? "Connecting…" : "Connect"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
