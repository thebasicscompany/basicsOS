"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, BookOpen, Users, CheckSquare, Video, Link2, Sparkles, Volume2, VolumeX, Check, Download, CodeBlock } from "@basicsos/ui";
import { useAuth } from "@/providers/AuthProvider";
import type { ComponentType, SVGProps } from "react";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

const ONBOARDING_KEY = "basicos_onboarding_done";

const CLAUDE_CONFIG = `{
  "mcpServers": {
    "basicsos": {
      "command": "bun",
      "args": ["run", "/path/to/basicsOS/apps/mcp/company/src/index.ts"],
      "env": {
        "MCP_TENANT_ID": "<your-tenant-id>",
        "DATABASE_URL": "<from your .env>",
        "REDIS_URL": "<from your .env>"
      }
    }
  }
}
// Tip: find your Tenant ID in Settings → MCP Connection`;

const STEPS: { id: number; title: string; Icon: LucideIcon }[] = [
  { id: 0, title: "Welcome", Icon: Sparkles },
  { id: 1, title: "Your Profile", Icon: Users },
  { id: 2, title: "Tour", Icon: BookOpen },
  { id: 3, title: "Connect AI", Icon: Sparkles },
  { id: 4, title: "Desktop App", Icon: Download },
];

const NARRATION: string[] = [
  "Welcome to Basics OS — your company's operating system. We'll get you set up in just a few minutes.",
  "Here's your profile. You're all set to get started. You can update your details in Settings at any time.",
  "Basics OS comes with six built-in modules: Knowledge Base, CRM, Tasks, Meetings, Hub, and an AI Assistant — all connected to one database.",
  "You can connect the Basics OS MCP server to Claude Desktop or Cursor so your AI tools can search your company data directly.",
  "Download the desktop app for a floating overlay you can open anywhere with Command Shift Space. You can also skip this and install it later.",
];

const MODULES: { Icon: LucideIcon; name: string; desc: string }[] = [
  { Icon: BookOpen, name: "Knowledge Base", desc: "Store and search team documents" },
  { Icon: Users, name: "CRM", desc: "Contacts, companies, and deals" },
  { Icon: CheckSquare, name: "Tasks", desc: "Track work with a kanban board" },
  { Icon: Video, name: "Meetings", desc: "AI-powered meeting summaries" },
  { Icon: Link2, name: "Hub", desc: "Links, integrations, and tools" },
  { Icon: Sparkles, name: "AI Assistant", desc: "Ask questions about company data" },
];

const isTTSSupported = typeof window !== "undefined" && "speechSynthesis" in window;

// Next.js App Router requires default export — framework exception
const OnboardingPage = (): JSX.Element => {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(ONBOARDING_KEY)) {
      router.replace("/");
    }
  }, [router]);

  const speak = useCallback(
    (text: string): void => {
      if (!isTTSSupported || !ttsEnabled) return;
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1.05;
      utt.pitch = 1.0;
      utt.onstart = () => setIsSpeaking(true);
      utt.onend = () => setIsSpeaking(false);
      utt.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utt);
    },
    [ttsEnabled],
  );

  useEffect(() => {
    const text = NARRATION[step];
    if (text) speak(text);
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, [step, speak]);

  useEffect(() => {
    if (!ttsEnabled) window.speechSynthesis?.cancel();
  }, [ttsEnabled]);

  const completeOnboarding = trpc.auth.completeOnboarding.useMutation({
    onSettled: () => {
      window.speechSynthesis?.cancel();
      if (typeof window !== "undefined") {
        localStorage.setItem(ONBOARDING_KEY, "1");
      }
      router.replace("/");
    },
  });

  const handleFinish = (): void => { completeOnboarding.mutate(); };

  const goToStep = (next: number): void => {
    window.speechSynthesis?.cancel();
    setStep(next);
  };

  return (
    <div className="mx-auto max-w-xl py-8">
      {/* Step indicator + TTS toggle */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                  ? "bg-primary/20 text-primary"
                  : "bg-stone-200 text-stone-500"
              }`}
            >
              {i < step ? <Check size={16} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-8 ${i < step ? "bg-primary/30" : "bg-stone-200"}`} />
            )}
          </div>
        ))}

        {isTTSSupported && (
          <Button
            variant="ghost"
            size="icon"
            title={ttsEnabled ? "Mute narration" : "Enable narration"}
            onClick={() => setTtsEnabled((v) => !v)}
            className="ml-auto h-8 w-8 text-stone-500 hover:text-stone-700"
          >
            {ttsEnabled ? <Volume2 size={18} className={isSpeaking ? "text-primary" : ""} /> : <VolumeX size={18} />}
          </Button>
        )}
      </div>

      {/* Step content */}
      <div className="rounded-lg bg-white p-8 shadow-card">
        {step === 0 && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-stone-200 text-stone-500">
                <Sparkles size={32} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-stone-900">Welcome to Basics OS</h1>
            <p className="text-stone-500">
              Your company operating system — all your knowledge, tasks, meetings, and AI tools in
              one place. Let&apos;s get you set up in just a few minutes.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-200 text-stone-500">
                <Users size={20} />
              </div>
              <h2 className="text-xl font-bold text-stone-900">Your Profile</h2>
            </div>
            <div className="rounded-lg bg-white p-4">
              <p className="text-sm font-medium text-stone-700">{user?.name ?? "\u2014"}</p>
              <p className="text-sm text-stone-500">{user?.email ?? "\u2014"}</p>
            </div>
            <p className="text-sm text-stone-500">
              You&apos;re logged in. You can update your name and password in Settings at any time.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-200 text-stone-500">
                <BookOpen size={20} />
              </div>
              <h2 className="text-xl font-bold text-stone-900">Module Tour</h2>
            </div>
            <p className="text-sm text-stone-500">Basics OS includes these built-in modules:</p>
            <div className="grid grid-cols-2 gap-3">
              {MODULES.map((m) => (
                <div key={m.name} className="rounded-lg bg-white p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-200 text-stone-500">
                    <m.Icon size={16} />
                  </div>
                  <div className="mt-2 text-sm font-medium text-stone-800">{m.name}</div>
                  <div className="text-xs text-stone-500">{m.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-200 text-stone-500">
                <Sparkles size={20} />
              </div>
              <h2 className="text-xl font-bold text-stone-900">Connect AI Tools</h2>
            </div>
            <p className="text-sm text-stone-500">
              Add the Basics OS MCP server to Claude Desktop or Cursor to query your company data
              directly from your AI assistant.
            </p>
            <CodeBlock label="claude_desktop_config.json" code={CLAUDE_CONFIG} />
            <p className="text-xs text-stone-500">
              You can also find this in <strong>Settings</strong> at any time.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-200 text-stone-500">
                <Download size={20} />
              </div>
              <h2 className="text-xl font-bold text-stone-900">Desktop App</h2>
            </div>
            <p className="text-sm text-stone-500">
              Install the desktop app for an always-accessible overlay you can open with{" "}
              <kbd className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-xs font-mono">
                ⌘⇧Space
              </kbd>{" "}
              anywhere on your Mac.
            </p>
            <Button asChild>
              <a href="/api/desktop">
                <Download size={14} className="mr-1" /> Download Desktop App
              </a>
            </Button>
            <p className="text-sm text-stone-500">
              You can also skip this and install later from <strong>Settings</strong>.
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" onClick={() => goToStep(step - 1)} disabled={step === 0}>
          Back
        </Button>

        <span className="text-xs text-stone-500">
          {step + 1} / {STEPS.length}
        </span>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => goToStep(step + 1)}>Next</Button>
        ) : (
          <Button onClick={handleFinish} disabled={completeOnboarding.isPending}>
            {completeOnboarding.isPending ? "Finishing..." : "Get Started"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
