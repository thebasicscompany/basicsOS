import { useState, useEffect, useRef, useCallback } from "react";
import { trpcCall } from "./api";

// ---------------------------------------------------------------------------
// IPC helpers
// ---------------------------------------------------------------------------

const getIPC = (): Window["electronAPI"] | undefined => window.electronAPI;

const sendIPC = (channel: string, ...args: unknown[]): void => {
  window.electronAPI?.send(channel, ...args);
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "ask" | "meetings" | "voice" | "capture";

// ---------------------------------------------------------------------------
// Voice command detection
// ---------------------------------------------------------------------------

type VoiceCommand =
  | { type: "create_task"; title: string }
  | { type: "search"; query: string }
  | { type: "navigate"; module: string; url: string }
  | null;

const MODULE_ROUTES: Record<string, string> = {
  tasks: "/tasks",
  task: "/tasks",
  crm: "/crm",
  contacts: "/crm",
  meetings: "/meetings",
  meeting: "/meetings",
  knowledge: "/knowledge",
  hub: "/hub",
  assistant: "/assistant",
  ai: "/assistant",
  settings: "/settings",
  admin: "/admin",
};

const detectCommand = (text: string): VoiceCommand => {
  const lower = text.trim().toLowerCase();

  const taskMatch =
    lower.match(/^(?:create|add|new) (?:a )?task[: ]+(.*)/i) ??
    lower.match(/^(?:remind me to|todo)[: ]+(.*)/i);
  if (taskMatch?.[1]) return { type: "create_task", title: taskMatch[1].trim() };

  const searchMatch = lower.match(/^(?:search|find|look up|look for)[: ]+(.*)/i);
  if (searchMatch?.[1]) return { type: "search", query: searchMatch[1].trim() };

  const openMatch = lower.match(/^(?:open|go to|show)[: ]+(\w+)/i);
  if (openMatch?.[1]) {
    const mod = openMatch[1].toLowerCase();
    const url = MODULE_ROUTES[mod];
    if (url) return { type: "navigate", module: mod, url };
  }

  return null;
};

// ---------------------------------------------------------------------------
// AskTab
// ---------------------------------------------------------------------------

const AskTab = (): JSX.Element => {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAsk = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setAnswer(null);
    try {
      const result = await trpcCall<{ answer: string }>("assistant.chat", {
        message: query.trim(),
        history: [],
      });
      setAnswer(result.answer);
    } catch (err: unknown) {
      setAnswer(err instanceof Error ? `Error: ${err.message}` : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: "New Task", icon: "✅", path: "/tasks" },
    { label: "CRM", icon: "🤝", path: "/crm" },
    { label: "Meetings", icon: "🎯", path: "/meetings" },
    { label: "Knowledge", icon: "📚", path: "/knowledge" },
  ];

  const openInMain = (path: string): void => {
    sendIPC("navigate-main", path);
  };

  return (
    <>
      <form onSubmit={(e) => void handleAsk(e)} className="px-4 pb-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">
            🔍
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about company data..."
            className="w-full bg-white/10 text-white placeholder-white/40 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 border border-white/10"
          />
        </div>
      </form>

      {(loading || answer) && (
        <div className="mx-4 mb-3 rounded-xl bg-white/10 p-3 text-sm text-white/80 max-h-32 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2">
              <span className="animate-spin inline-block">⏳</span> Thinking...
            </div>
          ) : (
            answer
          )}
        </div>
      )}

      <div className="px-4 pb-2">
        <div className="text-xs font-medium text-white/40 uppercase mb-2">Quick Actions</div>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => openInMain(action.path)}
              className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2.5 text-sm font-medium transition"
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={() => openInMain("/")}
          className="w-full flex items-center justify-between rounded-xl bg-indigo-600/40 hover:bg-indigo-600/60 px-4 py-3 text-sm font-medium transition"
        >
          <span>Open Basics OS Dashboard</span>
          <span className="text-white/60">→</span>
        </button>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// MeetingsTab — with live recording indicator and live transcript panel
// ---------------------------------------------------------------------------

type Meeting = {
  id: string;
  title: string;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
};

type TranscriptChunk = { speaker: string; text: string; timestampMs: number };

const LiveTranscriptPanel = ({
  meetingId,
  title,
}: {
  meetingId: string;
  title: string;
}): JSX.Element => {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);

  useEffect(() => {
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const data = await trpcCall<TranscriptChunk[]>(
          "meetings.getTranscript",
          { meetingId, limit: 50 },
          "query",
        );
        if (!cancelled) setChunks(data);
      } catch {
        // ignore polling errors
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [meetingId]);

  // Auto-scroll to bottom as new chunks arrive
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chunks]);

  return (
    <div className="mx-4 mb-3 rounded-xl bg-red-500/10 border border-red-500/20 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-red-500/20">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-semibold text-red-300 truncate max-w-[160px]">
            {title}
          </span>
        </div>
        <button
          type="button"
          onClick={() => sendIPC("navigate-main", `/meetings/${meetingId}`)}
          className="text-xs text-indigo-400 hover:underline shrink-0"
        >
          Open →
        </button>
      </div>

      <div ref={transcriptRef} className="px-3 py-2 max-h-36 overflow-y-auto space-y-1">
        {chunks.length === 0 ? (
          <p className="text-xs text-white/30 italic">Waiting for transcript…</p>
        ) : (
          chunks.map((chunk, i) => (
            <div key={i} className="text-xs leading-relaxed">
              <span className="font-semibold text-indigo-300">{chunk.speaker}: </span>
              <span className="text-white/70">{chunk.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const MeetingsTab = (): JSX.Element => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const data = await trpcCall<Meeting[]>("meetings.list", { limit: 5 }, "query");
        if (!cancelled) {
          setMeetings(data);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="px-4 py-6 text-center text-white/40 text-sm">
        <span className="animate-spin inline-block">⏳</span> Loading meetings...
      </div>
    );
  }

  const liveMeeting = meetings.find((m) => m.startedAt !== null && m.endedAt === null);

  if (meetings.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-white/40 text-sm">
        No recent meetings.
        <br />
        <button
          type="button"
          onClick={() => sendIPC("navigate-main", "/meetings/new")}
          className="text-indigo-400 hover:underline mt-2 inline-block"
        >
          Start one →
        </button>
      </div>
    );
  }

  return (
    <div className="pb-4 space-y-2">
      {liveMeeting && (
        <LiveTranscriptPanel meetingId={liveMeeting.id} title={liveMeeting.title} />
      )}

      <div className="px-4 space-y-2">
        <div className="text-xs font-medium text-white/40 uppercase mb-2">
          {liveMeeting ? "Other Meetings" : "Recent Meetings"}
        </div>
        {meetings.map((m) => {
          const when = m.startedAt ? new Date(m.startedAt).toLocaleDateString() : "No date";
          const isLive = m.startedAt !== null && m.endedAt === null;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => sendIPC("navigate-main", `/meetings/${m.id}`)}
              className="w-full flex items-start gap-3 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-3 transition text-left"
            >
              <span className="text-lg mt-0.5">{isLive ? "🔴" : "🎯"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{m.title}</span>
                  {isLive && (
                    <span className="text-[10px] font-semibold bg-red-500/40 text-red-300 px-1.5 py-0.5 rounded-full shrink-0 animate-pulse">
                      LIVE
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/40 mt-0.5">
                  {isLive ? "Recording in progress" : when}
                </div>
              </div>
              <span className="ml-auto text-white/30 text-sm self-center">→</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => sendIPC("navigate-main", "/meetings")}
          className="block w-full text-center text-xs text-indigo-400 hover:underline pt-1"
        >
          View all meetings →
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// CaptureTab — Workflow Capture
// ---------------------------------------------------------------------------

const CaptureTab = (): JSX.Element => {
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

  return (
    <div className="px-4 pb-4 space-y-3">
      <div className="text-xs font-medium text-white/40 uppercase">Workflow Capture</div>
      <p className="text-xs text-white/30 leading-relaxed">
        Take a screenshot of your current workflow. Claude will describe what&apos;s happening and
        save it to your Knowledge Base.
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-white/50">Document title</label>
        <input
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          className="w-full bg-white/10 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 border border-white/10"
          placeholder="Captured Workflow"
        />
      </div>

      <button
        type="button"
        onClick={() => void handleCapture()}
        disabled={status === "capturing" || status === "analyzing"}
        className="w-full rounded-xl bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed py-3 text-sm font-semibold transition flex items-center justify-center gap-2"
      >
        {status === "capturing" && <span className="animate-spin">⏳</span>}
        {status === "analyzing" && <span className="animate-pulse">🧠</span>}
        {status === "idle" || status === "done" || status === "error"
          ? "📸 Capture Screen Now"
          : status === "capturing"
            ? "Capturing…"
            : "Analyzing with Claude…"}
      </button>

      {status === "done" && result && (
        <div className="rounded-xl bg-white/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-green-400">✅ Saved to Knowledge Base</span>
            <button
              type="button"
              onClick={() => sendIPC("navigate-main", "/knowledge")}
              className="text-xs text-indigo-400 hover:underline"
            >
              View →
            </button>
          </div>
          <p className="text-xs text-white/60 line-clamp-4">{result.analysis}</p>
        </div>
      )}

      {status === "error" && errorMsg && (
        <div className="rounded-xl bg-red-500/20 border border-red-500/30 px-3 py-2 text-xs text-red-300">
          {errorMsg}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// VoiceTab — Wispr Flow (dictate + command modes)
// ---------------------------------------------------------------------------

type WisprMode = "dictate" | "command";

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
};
type SpeechRecognitionResultList = Array<SpeechRecognitionResult>;
type SpeechRecognitionResult = { isFinal: boolean } & Array<{ transcript: string }>;
type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

const VoiceTab = (): JSX.Element => {
  const [mode, setMode] = useState<WisprMode>("dictate");
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const modeRef = useRef<WisprMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const isSpeechSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition !== undefined || window.webkitSpeechRecognition !== undefined);

  const stopListening = useCallback((): void => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText("");
  }, []);

  const handleFinalSegment = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (modeRef.current === "dictate") {
        const ipc = getIPC();
        if (ipc?.injectText) {
          await ipc.injectText(trimmed + " ");
          setStatus("Injected ✓");
          setTimeout(() => setStatus(null), 1500);
        } else {
          setTranscript((prev) => prev + trimmed + " ");
        }
      } else {
        const cmd = detectCommand(trimmed);
        if (!cmd) {
          setStatus(`Not recognized: "${trimmed}"`);
          setTimeout(() => setStatus(null), 2500);
          return;
        }

        if (cmd.type === "create_task") {
          setStatus(`Creating task: "${cmd.title}"…`);
          try {
            await trpcCall("tasks.create", { title: cmd.title, description: "" });
            setStatus(`✅ Task created: "${cmd.title}"`);
          } catch {
            setStatus("❌ Failed to create task");
          }
          setTimeout(() => setStatus(null), 3000);
        } else if (cmd.type === "navigate") {
          sendIPC("navigate-main", cmd.url);
          setStatus(`→ Opened ${cmd.module}`);
          setTimeout(() => setStatus(null), 1500);
        } else if (cmd.type === "search") {
          sendIPC("navigate-main", `/knowledge?q=${encodeURIComponent(cmd.query)}`);
          setStatus(`🔍 Searching "${cmd.query}"…`);
          setTimeout(() => setStatus(null), 1500);
        }
      }
    },
    [],
  );

  const startListening = useCallback((): void => {
    setError(null);
    setTranscript("");
    setStatus(null);
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = modeRef.current === "dictate";
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (e) => {
      let interim = "";
      for (const result of Array.from(e.results) as SpeechRecognitionResultList) {
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          void handleFinalSegment(text);
        } else {
          interim = text;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (e) => {
      setError(`Microphone error: ${e.error}`);
      stopListening();
    };

    recognition.onend = () => {
      setInterimText("");
      if (modeRef.current === "command" && recognitionRef.current !== null) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            /* already started */
          }
        }, 300);
      } else {
        setIsListening(false);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [stopListening, handleFinalSegment]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
  }, []);

  if (!isSpeechSupported) {
    return (
      <div className="px-4 py-6 text-center text-white/40 text-sm">
        Voice requires Chrome or a Chromium-based browser.
      </div>
    );
  }

  const displayText = (transcript + interimText).trim();

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Mode toggle */}
      <div className="flex rounded-xl overflow-hidden border border-white/10">
        {(["dictate", "command"] as WisprMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              stopListening();
              setMode(m);
              setTranscript("");
              setStatus(null);
            }}
            className={`flex-1 py-1.5 text-xs font-medium transition ${
              mode === m
                ? "bg-indigo-600 text-white"
                : "text-white/40 hover:text-white/70 hover:bg-white/10"
            }`}
          >
            {m === "dictate" ? "✍️ Dictate" : "⚡ Command"}
          </button>
        ))}
      </div>

      {/* Mode hint */}
      <p className="text-xs text-white/30 text-center leading-relaxed">
        {mode === "dictate"
          ? "Speech is injected into the active text field"
          : 'Say: "create task …", "open meetings", "search …"'}
      </p>

      {/* Mic button */}
      <button
        onClick={isListening ? stopListening : startListening}
        className={`w-full rounded-xl py-5 flex flex-col items-center gap-2 transition font-medium text-sm ${
          isListening
            ? "bg-red-500/30 border border-red-500/50 text-red-300"
            : "bg-white/10 hover:bg-white/20 border border-white/10 text-white"
        }`}
        type="button"
      >
        <span className={`text-3xl ${isListening ? "animate-pulse" : ""}`}>
          {isListening ? "🔴" : "🎙️"}
        </span>
        <span>
          {isListening
            ? mode === "command"
              ? "Listening for command…"
              : "Dictating… (click to stop)"
            : `Click to start ${mode === "command" ? "voice commands" : "dictation"}`}
        </span>
      </button>

      {/* Status / command feedback */}
      {status && (
        <div className="rounded-xl bg-indigo-600/20 border border-indigo-500/30 px-3 py-2 text-xs text-indigo-300 text-center">
          {status}
        </div>
      )}

      {/* Interim text (command mode preview) */}
      {interimText && mode === "command" && (
        <div className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/40 italic text-center">
          {interimText}
        </div>
      )}

      {/* Transcript (dictate fallback — only shown when injectText is unavailable) */}
      {displayText && mode === "dictate" && !getIPC()?.injectText && (
        <div className="rounded-xl bg-white/10 p-3 text-sm text-white/80 min-h-[60px] max-h-28 overflow-y-auto">
          {transcript}
          {interimText && <span className="text-white/40">{interimText}</span>}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/20 border border-red-500/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Root overlay
// ---------------------------------------------------------------------------

export const OverlayApp = (): JSX.Element => {
  const [tab, setTab] = useState<Tab>("ask");

  const handleMouseEnter = (): void => {
    sendIPC("set-ignore-mouse", false);
  };
  const handleMouseLeave = (): void => {
    sendIPC("set-ignore-mouse", true);
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "ask", label: "Ask", icon: "🔍" },
    { id: "meetings", label: "Meetings", icon: "🎯" },
    { id: "voice", label: "Voice", icon: "🎙️" },
    { id: "capture", label: "Capture", icon: "📸" },
  ];

  return (
    <div className="h-screen bg-transparent">
      <div
        className="bg-black/85 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col text-white select-none shadow-2xl"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
            B
          </div>
          <span className="text-sm font-semibold text-white/90">Basics OS</span>
          <span className="ml-auto text-xs text-white/30">⌘⇧Space to close</span>
        </div>

        {/* Tab bar */}
        <div className="flex px-4 pb-3 gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              type="button"
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
                tab === t.id
                  ? "bg-white/20 text-white"
                  : "text-white/40 hover:text-white/70 hover:bg-white/10"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
          {tab === "ask" && <AskTab />}
          {tab === "meetings" && <MeetingsTab />}
          {tab === "voice" && <VoiceTab />}
          {tab === "capture" && <CaptureTab />}
        </div>
      </div>
    </div>
  );
};
