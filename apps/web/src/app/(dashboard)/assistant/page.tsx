"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUp, Loader2, Mic, MicOff, Volume2, Button, Textarea, PageHeader, Card } from "@basicsos/ui";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

// Minimal local types for Web Speech API (not all browsers expose these globally)
type SpeechRecognitionClass = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: SpeechRecognitionResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionClass;
    webkitSpeechRecognition?: SpeechRecognitionClass;
  }
}

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

// Next.js App Router requires default export — framework exception
const AssistantPage = (): JSX.Element => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [hasSpeechApi, setHasSpeechApi] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionClass> | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setHasSpeechApi(
      window.SpeechRecognition !== undefined || window.webkitSpeechRecognition !== undefined,
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Voice input (Web Speech API → populate textarea)
  // ---------------------------------------------------------------------------
  const stopListening = useCallback((): void => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const startListening = useCallback((): void => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript) setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, []);

  const handleMicClick = useCallback((): void => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  // ---------------------------------------------------------------------------
  // TTS playback (gateway Deepgram via basicsOS API proxy)
  // ---------------------------------------------------------------------------
  const speakMessage = useCallback(async (messageId: string, text: string): Promise<void> => {
    // Stop any currently playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setSpeakingId(null);
      return;
    }

    setSpeakingId(messageId);
    try {
      const res = await fetch(`${API_URL}/v1/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;

      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        setSpeakingId(null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        setSpeakingId(null);
      };
      void audio.play();
    } catch {
      setSpeakingId(null);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim() || isStreaming) return;

      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
      const assistantId = crypto.randomUUID();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsStreaming(true);

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${API_URL}/stream/assistant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: text, history }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const err = await res.text();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Error: ${err || res.statusText}`, streaming: false }
                : m,
            ),
          );
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            const raw = dataLine.slice(6).trim();
            if (raw === "[DONE]") break;

            try {
              const event = JSON.parse(raw) as { token?: string; error?: string };
              if (event.token) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + event.token } : m,
                  ),
                );
              }
              if (event.error) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content || `Error: ${event.error}`, streaming: false }
                      : m,
                  ),
                );
              }
            } catch {
              /* malformed event */
            }
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string }).name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Connection error: ${message}`, streaming: false }
              : m,
          ),
        );
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
        );
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming],
  );

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    void sendMessage(input.trim());
  };

  const handleStop = (): void => {
    abortRef.current?.abort();
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="AI Assistant"
        description="Ask questions about your company knowledge, tasks, meetings, and more."
        className="mb-6"
      />

      <Card className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 pt-16 text-center">
              <h2 className="text-lg font-semibold font-serif text-stone-700">How can I help?</h2>
              <p className="max-w-sm text-sm text-stone-500">
                Ask about your company data, find documents, check tasks, review meeting notes, or
                get answers from your knowledge base.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  "What are my open tasks?",
                  "Summarize recent meetings",
                  "Find knowledge docs about onboarding",
                  "Who are our top CRM contacts?",
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => void sendMessage(suggestion)}
                    className="rounded-full text-xs"
                    type="button"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className="group relative">
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-stone-900 border-l-2 border-primary/20"
                  }`}
                >
                  {msg.content}
                  {msg.streaming && msg.content && (
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-muted-foreground" />
                  )}
                  {msg.streaming && !msg.content && (
                    <span className="flex items-center gap-1.5 text-stone-500">
                      <Loader2 size={12} className="animate-spin" /> Thinking...
                    </span>
                  )}
                </div>

                {/* TTS button on assistant messages */}
                {msg.role === "assistant" && !msg.streaming && msg.content && (
                  <button
                    type="button"
                    onClick={() => void speakMessage(msg.id, msg.content)}
                    className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-stone-200 text-stone-400 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-stone-700"
                    title={speakingId === msg.id ? "Stop" : "Listen"}
                  >
                    <Volume2
                      size={11}
                      className={speakingId === msg.id ? "text-primary" : ""}
                    />
                  </button>
                )}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-3 p-4 pt-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
            rows={2}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl bg-muted min-h-0"
          />

          {/* Mic button — only shown when Web Speech API is available */}
          {hasSpeechApi && !isStreaming && (
            <Button
              type="button"
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              onClick={handleMicClick}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </Button>
          )}

          {isStreaming ? (
            <Button type="button" variant="destructive" onClick={handleStop}>
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()} size="icon">
              <ArrowUp size={16} />
            </Button>
          )}
        </form>
      </Card>
    </div>
  );
};

export default AssistantPage;
