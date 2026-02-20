import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Pencil, Zap, Button, Tabs, TabsList, TabsTrigger } from "@basicsos/ui";
import { trpcCall } from "../api";
import { getIPC, sendIPC } from "../lib/ipc";
import { detectCommand } from "../lib/voice-commands";

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

export const VoiceTab = (): JSX.Element => {
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
          setStatus("Injected");
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
          setStatus(`Creating task: "${cmd.title}"...`);
          try {
            await trpcCall("tasks.create", { title: cmd.title, description: "" });
            setStatus(`Task created: "${cmd.title}"`);
          } catch {
            setStatus("Failed to create task");
          }
          setTimeout(() => setStatus(null), 3000);
        } else if (cmd.type === "navigate") {
          sendIPC("navigate-main", cmd.url);
          setStatus(`Opened ${cmd.module}`);
          setTimeout(() => setStatus(null), 1500);
        } else if (cmd.type === "search") {
          sendIPC("navigate-main", `/knowledge?q=${encodeURIComponent(cmd.query)}`);
          setStatus(`Searching "${cmd.query}"...`);
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
      <div className="px-4 py-6 text-center text-stone-500 text-sm">
        Voice requires Chrome or a Chromium-based browser.
      </div>
    );
  }

  const displayText = (transcript + interimText).trim();

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Mode toggle — pill segmented control */}
      <Tabs
        value={mode}
        onValueChange={(v) => {
          stopListening();
          setMode(v as WisprMode);
          setTranscript("");
          setStatus(null);
        }}
      >
        <TabsList className="w-full">
          <TabsTrigger value="dictate" className="flex-1 gap-1.5 text-xs">
            <Pencil size={12} /> Dictate
          </TabsTrigger>
          <TabsTrigger value="command" className="flex-1 gap-1.5 text-xs">
            <Zap size={12} /> Command
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Mode hint */}
      <p className="text-xs text-stone-500 text-center leading-relaxed">
        {mode === "dictate"
          ? "Speech is injected into the active text field"
          : 'Say: "create task ...", "open meetings", "search ..."'}
      </p>

      {/* Mic button */}
      <Button
        variant="outline"
        onClick={isListening ? stopListening : startListening}
        className={`w-full rounded-xl py-5 h-auto flex flex-col items-center gap-2 font-medium text-sm ${
          isListening
            ? "bg-destructive/5 border-destructive/20 text-destructive ring-4 ring-destructive/10"
            : ""
        }`}
      >
        <Mic size={28} className={isListening ? "animate-pulse" : ""} />
        <span>
          {isListening
            ? mode === "command"
              ? "Listening for command..."
              : "Dictating... (click to stop)"
            : `Click to start ${mode === "command" ? "voice commands" : "dictation"}`}
        </span>
      </Button>

      {/* Status / command feedback */}
      {status && (
        <div className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-primary text-center font-medium">
          {status}
        </div>
      )}

      {/* Interim text (command mode preview) */}
      {interimText && mode === "command" && (
        <div className="rounded-xl bg-stone-200 px-3 py-2 text-xs text-stone-500 italic text-center">
          {interimText}
        </div>
      )}

      {/* Transcript (dictate fallback) */}
      {displayText && mode === "dictate" && !getIPC()?.injectText && (
        <div className="rounded-xl bg-stone-200 p-3 text-sm text-stone-700 min-h-[60px] max-h-28 overflow-y-auto">
          {transcript}
          {interimText && <span className="text-stone-500">{interimText}</span>}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-destructive/5 border border-destructive/20 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
};
