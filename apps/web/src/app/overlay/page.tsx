"use client";

import { useState } from "react";
import { CheckSquare, Handshake, Target, Books, MagnifyingGlass, SpinnerGap, ArrowRight } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

// Detect whether we're running inside Electron with the preload bridge exposed.
const isElectron =
  typeof window !== "undefined" &&
  typeof (window as unknown as Record<string, unknown>).electronIPC !== "undefined";

const sendIPC = (channel: string, ...args: unknown[]): void => {
  if (!isElectron) return;
  (
    window as unknown as Record<string, { send?: (ch: string, ...a: unknown[]) => void }>
  ).electronIPC?.send?.(channel, ...args);
};

// This page is loaded inside the Electron overlay window.
// It's a floating HUD that appears over any app via Cmd+Shift+Space.
const OverlayPage = (): JSX.Element => {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setAnswer(null);
    // Simulate a response (real RAG chat needs API server running)
    await new Promise((r) => setTimeout(r, 600));
    setAnswer(
      `Searching company data for: "${query}"… Add ANTHROPIC_API_KEY to .env for live AI responses.`
    );
    setLoading(false);
  };

  const quickActions: { label: string; icon: Icon; href: string }[] = [
    { label: "New Task", icon: CheckSquare, href: "http://localhost:3000/tasks" },
    { label: "CRM", icon: Handshake, href: "http://localhost:3000/crm" },
    { label: "Meetings", icon: Target, href: "http://localhost:3000/meetings" },
    { label: "Knowledge", icon: Books, href: "http://localhost:3000/knowledge" },
  ];

  // Mouse enters the interactive panel → capture events (don't pass through)
  const handleMouseEnter = (): void => {
    sendIPC("set-ignore-mouse", false);
  };

  // Mouse leaves the interactive panel → ignore events (pass through to app underneath)
  const handleMouseLeave = (): void => {
    sendIPC("set-ignore-mouse", true);
  };

  return (
    // Full-screen transparent shell — clicks here pass through to apps underneath
    <div className="h-screen bg-transparent">
      {/* Interactive panel — clicks here are captured by the overlay */}
      <div
        className="bg-black/80 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col text-white select-none"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
            B
          </div>
          <span className="text-sm font-semibold text-white/90">
            Basics OS Assistant
          </span>
          <span className="ml-auto text-xs text-white/40">⌘⇧Space to close</span>
        </div>

        {/* Search / Ask */}
        <form onSubmit={handleAsk} className="px-4 pb-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
              <MagnifyingGlass size={16} />
            </span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about company data..."
              className="w-full bg-white/10 text-white placeholder-white/40 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 border border-white/10"
            />
          </div>
        </form>

        {/* Answer */}
        {(loading || answer) && (
          <div className="mx-4 mb-3 rounded-xl bg-white/10 p-3 text-sm text-white/80">
            {loading ? (
              <div className="flex items-center gap-2">
                <SpinnerGap size={16} className="animate-spin" /> Thinking...
              </div>
            ) : (
              answer
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="px-4 pb-2">
          <div className="text-xs font-medium text-white/40 uppercase mb-2">
            Quick Actions
          </div>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <a
                key={action.label}
                href={action.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2.5 text-sm font-medium transition"
              >
                <action.icon size={18} />
                <span>{action.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Open App */}
        <div className="px-4 pb-4 flex-1">
          <div className="text-xs font-medium text-white/40 uppercase mb-2">
            Open App
          </div>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl bg-indigo-600/40 hover:bg-indigo-600/60 px-4 py-3 text-sm font-medium transition"
          >
            <span>Open Basics OS Dashboard</span>
            <ArrowRight size={16} className="text-white/60" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default OverlayPage;
