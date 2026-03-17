import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRightIcon,
  ArrowLeftIcon,
  KeyboardIcon,
  LinkSimpleIcon,
  SparkleIcon,
  ShieldCheckIcon,
  MonitorIcon,
  HandIcon,
  CheckCircleIcon,
  ArrowClockwiseIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ConnectionsContent } from "@/components/connections/ConnectionsContent";
import { ShortcutRow } from "@/components/shortcuts/ShortcutRecorder";
import {
  useShortcutRecording,
  getShortcutDisplayValue,
} from "@/components/shortcuts/shortcut-recorder-utils";
import { setWalkthroughResume } from "@/components/onboarding/walkthrough-resume";
import { saveWizardCompletedSteps, readWizardCompletedSteps } from "@/lib/wizard-storage";
import { useQuery } from "@tanstack/react-query";
import { getRuntimeApiUrl } from "@/lib/runtime-config";

const API_URL = getRuntimeApiUrl();

/* ── Shared slide animation ──────────────────────────────────────────────── */

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -56 : 56, opacity: 0 }),
};

/* ── Dot navigation ──────────────────────────────────────────────────────── */

function DotNav({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? "w-5 h-2 bg-foreground"
              : i < current
                ? "w-2 h-2 bg-foreground/40"
                : "w-2 h-2 bg-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const isElectron = typeof window !== "undefined" && "electronAPI" in window;

function getElectronAPI() {
  if (!isElectron) return null;
  return (window as any).electronAPI as Record<string, (...args: any[]) => any> | undefined;
}

/* ── Step: Enable permissions ────────────────────────────────────────────── */

function PermissionsStep({
  onAdvance,
  userId,
}: {
  onAdvance: () => void;
  userId?: number | string | null;
}) {
  const [screenGranted, setScreenGranted] = useState(false);
  const [a11yGranted, setA11yGranted] = useState(false);
  const [prompted, setPrompted] = useState({ screen: false, a11y: false });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialCheckDone = useRef(false);

  const api = getElectronAPI();

  // One-time check on mount to detect already-granted permissions.
  useEffect(() => {
    if (!api || initialCheckDone.current) return;
    initialCheckDone.current = true;
    (async () => {
      try {
        const sr = await api.checkSystemAudioPermission?.();
        if (sr) setScreenGranted(true);
        const a11y = await api.checkAccessibilityPermission?.();
        if (a11y) {
          setA11yGranted(true);
          api.restartKeyMonitor?.();
        } else {
          const running = await api.checkKeyMonitorStatus?.();
          if (running) setA11yGranted(true);
        }
      } catch {
        // ignore
      }
    })();
  }, [api]);

  // Continuous polling only starts AFTER the user clicks Enable for each
  // permission. For accessibility, we use two detection methods:
  // 1. isTrustedAccessibilityClient(false) — can be unreliable on some macOS versions
  // 2. Attempt to restart key-monitor — if it starts, accessibility is confirmed
  useEffect(() => {
    if (!api) return;
    if (!prompted.screen && !prompted.a11y) return;
    const poll = async () => {
      try {
        if (prompted.screen && !screenGranted) {
          const sr = await api.checkSystemAudioPermission?.();
          if (sr) setScreenGranted(true);
        }
        if (prompted.a11y && !a11yGranted) {
          const a11y = await api.checkAccessibilityPermission?.();
          if (a11y) {
            setA11yGranted(true);
            api.restartKeyMonitor?.();
          } else {
            await api.restartKeyMonitor?.();
            const running = await api.checkKeyMonitorStatus?.();
            if (running) {
              setA11yGranted(true);
            }
          }
        }
      } catch {
        // ignore
      }
    };
    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [api, prompted.screen, prompted.a11y, screenGranted, a11yGranted]);

  const handleScreenRecording = useCallback(async () => {
    const result = await api?.promptScreenRecording?.();
    setPrompted((p) => ({ ...p, screen: true }));
    if (result) setScreenGranted(true);
  }, [api]);

  const handleAccessibility = useCallback(async () => {
    const result = await api?.promptAccessibility?.();
    setPrompted((p) => ({ ...p, a11y: true }));
    if (result) setA11yGranted(true);
  }, [api]);

  const bothGranted = screenGranted && a11yGranted;

  const handleRestart = useCallback(() => {
    if (userId != null) {
      const existing = readWizardCompletedSteps(userId);
      const all = Array.from(new Set([...existing, "enable-permissions"]));
      saveWizardCompletedSteps(userId, all);
      setWalkthroughResume(userId);
    }
    api?.restartApp?.();
  }, [api, userId]);

  return (
    <div className="flex flex-col items-center gap-5 text-center w-full">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-amber-500">
        <ShieldCheckIcon weight="duotone" className="h-7 w-7" />
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Enable permissions
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-[320px]">
          Basics needs two macOS permissions to work properly.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {/* Screen Recording card */}
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
            screenGranted
              ? "border-green-500/40 bg-green-500/5"
              : "bg-muted/30"
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              screenGranted
                ? "bg-green-500/10 text-green-500"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {screenGranted ? (
              <CheckCircleIcon weight="fill" className="h-5 w-5" />
            ) : (
              <MonitorIcon weight="duotone" className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">Screen Recording</p>
            <p className="text-xs text-muted-foreground">
              Required for meeting recording and system audio
            </p>
          </div>
          {!screenGranted && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleScreenRecording}
              className="shrink-0"
            >
              {prompted.screen ? "Open Settings" : "Enable"}
            </Button>
          )}
        </div>

        {/* Accessibility card */}
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
            a11yGranted
              ? "border-green-500/40 bg-green-500/5"
              : "bg-muted/30"
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              a11yGranted
                ? "bg-green-500/10 text-green-500"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {a11yGranted ? (
              <CheckCircleIcon weight="fill" className="h-5 w-5" />
            ) : (
              <HandIcon weight="duotone" className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">Accessibility</p>
            <p className="text-xs text-muted-foreground">
              Required for global keyboard shortcuts to work anywhere
            </p>
          </div>
          {!a11yGranted && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAccessibility}
              className="shrink-0"
            >
              {prompted.a11y ? "Open Settings" : "Enable"}
            </Button>
          )}
        </div>
      </div>

      {bothGranted ? (
        prompted.screen || prompted.a11y ? (
          <Button onClick={handleRestart} className="gap-1.5">
            <ArrowClockwiseIcon className="size-3.5" />
            Quit and restart Basics so permissions take effect
          </Button>
        ) : (
          <Button onClick={onAdvance} className="gap-1.5">
            Continue
          </Button>
        )
      ) : (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground/60">
            Enable both permissions above to continue
          </p>
          <Button variant="ghost" size="sm" onClick={onAdvance} className="text-xs text-muted-foreground">
            Skip for now
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── Step: Configure shortcuts ───────────────────────────────────────────── */

function ShortcutsStep({ onAdvance }: { onAdvance: () => void }) {
  const {
    overlaySettings,
    recordingSlot,
    liveKeys,
    handleRecordShortcut,
    cancelRecording,
  } = useShortcutRecording();

  if (!isElectron) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-indigo-500">
          <KeyboardIcon weight="duotone" className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Configure your shortcuts</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-[300px]">
            Global shortcuts are available in the desktop app. Your defaults are already set — you can adjust them anytime from Settings.
          </p>
        </div>
        <div className="w-full max-w-sm rounded-xl border bg-muted/30 p-4 text-left space-y-2">
          <ShortcutRow label="Voice assistant" description="Open the floating pill" value="Shift+Fn" onRecord={() => {}} isRecording={false} liveKeys="" onCancel={() => {}} />
          <ShortcutRow label="Dictation" description="Hold to inject speech" value="Fn" onRecord={() => {}} isRecording={false} liveKeys="" onCancel={() => {}} />
          <ShortcutRow label="Meeting recording" description="Toggle meeting recording" value="Shift+M" onRecord={() => {}} isRecording={false} liveKeys="" onCancel={() => {}} />
        </div>
        <Button onClick={onAdvance} className="gap-1.5">
          Looks good — continue
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center w-full">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-indigo-500">
        <KeyboardIcon weight="duotone" className="h-7 w-7" />
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Configure your shortcuts</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-[300px]">
          Click a shortcut to record it — just press the key combo you want. Defaults are already set.
        </p>
      </div>

      <ul className="w-full max-w-sm space-y-3 text-left">
        {(["assistant", "dictation", "meeting"] as const).map((slot) => (
          <ShortcutRow
            key={slot}
            label={
              slot === "assistant"
                ? "Voice assistant"
                : slot === "dictation"
                  ? "Dictation"
                  : "Meeting recording"
            }
            description={
              slot === "assistant"
                ? "Open the floating pill to talk to the AI"
                : slot === "dictation"
                  ? "Hold to inject speech into any text field"
                  : "Toggle meeting recording"
            }
            value={getShortcutDisplayValue(slot, overlaySettings)}
            onRecord={() => void handleRecordShortcut(slot)}
            isRecording={recordingSlot === slot}
            liveKeys={liveKeys}
            onCancel={cancelRecording}
          />
        ))}
      </ul>

      <Button onClick={onAdvance} className="gap-1.5">
        Looks good — continue
        <ArrowRightIcon className="size-3.5" />
      </Button>
    </div>
  );
}

/* ── Step: Connect services ──────────────────────────────────────────────── */

type Connection = { provider: string };

function ConnectServicesStep({ onAdvance }: { onAdvance: () => void }) {
  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: ["connections"],
    queryFn: () =>
      fetch(`${API_URL}/api/connections`, { credentials: "include" }).then(
        (r) => (r.ok ? (r.json() as Promise<Connection[]>) : []),
      ),
    refetchInterval: 3000,
  });

  const anyConnected = connections.length > 0;

  return (
    <div className="flex flex-col items-center gap-5 text-center w-full">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-sky-500">
        <LinkSimpleIcon weight="duotone" className="h-7 w-7" />
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Connect Gmail and Slack</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-[300px]">
          Sync your inbox to discover contacts and power email workflows. Connect Slack for automated notifications.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-xl border bg-muted/30 p-4">
        <ConnectionsContent compact embeddedInSettings />
      </div>

      <Button onClick={onAdvance} className="gap-1.5">
        {anyConnected ? "Connected — continue" : "Continue"}
        <ArrowRightIcon className="size-3.5" />
      </Button>
    </div>
  );
}

/* ── Step: Done ──────────────────────────────────────────────────────────── */

function DoneStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-primary">
        <SparkleIcon weight="duotone" className="h-7 w-7" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">You're all set!</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-[280px]">
          Your workspace is ready. You can revisit setup anytime from the Help Center.
        </p>
      </div>
      <Button onClick={onFinish} className="gap-1.5">
        Go to Home
        <ArrowRightIcon className="size-3.5" />
      </Button>
    </div>
  );
}

/* ── Step definitions ────────────────────────────────────────────────────── */

const STEP_IDS = [
  "enable-permissions",
  "configure-shortcuts",
  "connect-services",
  "done",
] as const;

type StepId = (typeof STEP_IDS)[number];

/* ── Main component ──────────────────────────────────────────────────────── */

export interface InteractiveWalkthroughProps {
  onComplete: () => void;
  userId?: number | string | null;
  hasApiKey?: boolean;
}

export function InteractiveWalkthrough({
  onComplete,
  userId,
}: InteractiveWalkthroughProps) {
  const alreadyCompleted = userId != null ? readWizardCompletedSteps(userId) : [];
  const permissionsAlreadyDone = alreadyCompleted.includes("enable-permissions");
  const skipPermissions = !isElectron || permissionsAlreadyDone;

  const initialStep = skipPermissions ? STEP_IDS.indexOf("configure-shortcuts") : 0;
  const [stepIdx, setStepIdx] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [completedIds, setCompletedIds] = useState<StepId[]>(
    permissionsAlreadyDone ? ["enable-permissions"] : [],
  );

  const currentStepId = STEP_IDS[stepIdx]!;

  const advance = useCallback(
    (doneId?: StepId) => {
      if (doneId) {
        setCompletedIds((prev) =>
          prev.includes(doneId) ? prev : [...prev, doneId],
        );
      }
      if (stepIdx < STEP_IDS.length - 1) {
        setDirection(1);
        setStepIdx((i) => i + 1);
      }
    },
    [stepIdx],
  );

  const minStep = skipPermissions ? STEP_IDS.indexOf("configure-shortcuts") : 0;

  const back = useCallback(() => {
    if (stepIdx > minStep) {
      setDirection(-1);
      setStepIdx((i) => i - 1);
    }
  }, [stepIdx, minStep]);

  const handleFinish = useCallback(() => {
    if (userId != null) {
      try {
        const existing = readWizardCompletedSteps(userId);
        const all = Array.from(
          new Set([...existing, ...completedIds, "done"]),
        );
        saveWizardCompletedSteps(userId, all);
      } catch {
        // ignore
      }
    }
    onComplete();
  }, [userId, completedIds, onComplete]);

  const isDone = currentStepId === "done";
  const isFirst = stepIdx <= minStep;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Top progress bar */}
      <div className="absolute top-0 inset-x-0 h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${((stepIdx + 1) / STEP_IDS.length) * 100}%` }}
        />
      </div>

      {/* Step counter label */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/60">
        Step {stepIdx + 1} of {STEP_IDS.length}
      </div>

      {/* Step content */}
      <div className="w-full max-w-md px-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepIdx}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            {currentStepId === "enable-permissions" && (
              <PermissionsStep
                onAdvance={() => advance("enable-permissions")}
                userId={userId}
              />
            )}
            {currentStepId === "configure-shortcuts" && (
              <ShortcutsStep
                onAdvance={() => advance("configure-shortcuts")}
              />
            )}
            {currentStepId === "connect-services" && (
              <ConnectServicesStep onAdvance={() => advance("connect-services")} />
            )}
            {currentStepId === "done" && <DoneStep onFinish={handleFinish} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      {!isDone && (
        <div className="absolute bottom-10 flex flex-col items-center gap-4">
          <DotNav total={STEP_IDS.length} current={stepIdx} />
          {!isFirst && (
            <Button variant="ghost" size="sm" onClick={back} className="gap-1.5">
              <ArrowLeftIcon className="size-3.5" />
              Back
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
