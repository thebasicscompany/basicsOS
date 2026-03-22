import { startTransition, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { ROUTES } from "@basics-os/hub";
import { authClient } from "@/lib/auth-client";

export function HostedAuthCompletingPage() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const announcedReadyRef = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (announcedReadyRef.current) return;
      announcedReadyRef.current = true;
      window.electronAPI?.notifyHostedAuthRenderReady?.();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    const complete = () => {
      startTransition(() => {
        navigate(ROUTES.CRM, { replace: true });
      });
    };

    if (typeof requestIdleCallback === "function") {
      const idleId = requestIdleCallback(complete, { timeout: 1500 });
      return () => cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(complete, 300);
    return () => clearTimeout(timeoutId);
  }, [navigate, session?.user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Finishing sign-in
          </h1>
          <p className="text-sm text-muted-foreground">
            Preparing your workspace without freezing the app.
          </p>
        </div>
      </div>
    </div>
  );
}
