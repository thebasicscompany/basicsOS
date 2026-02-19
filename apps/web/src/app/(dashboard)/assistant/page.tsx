"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, ArrowUp, Loader2, Button } from "@basicsos/ui";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

// Next.js App Router requires default export — framework exception
const AssistantPage = (): JSX.Element => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string): Promise<void> => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", streaming: true };

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
          } catch { /* malformed event */ }
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
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    void sendMessage(input.trim());
  };

  const handleStop = (): void => {
    abortRef.current?.abort();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">AI Assistant</h1>
        <p className="mt-1 text-sm text-stone-500">
          Ask questions about your company knowledge, tasks, meetings, and more.
        </p>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 pt-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles size={28} />
              </div>
              <h2 className="text-xl font-semibold text-stone-700">How can I help?</h2>
              <p className="max-w-sm text-sm text-stone-400">
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
                  <button
                    key={suggestion}
                    onClick={() => void sendMessage(suggestion)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-stone-600 hover:border-primary hover:text-primary transition-colors"
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
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
                  <span className="flex items-center gap-1.5 text-stone-400">
                    <Loader2 size={12} className="animate-spin" /> Thinking...
                  </span>
                )}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-3 border-t border-stone-200 p-4">
          <textarea
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
            className="flex-1 resize-none rounded-xl border border-stone-200 bg-muted px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
          />
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
      </div>
    </div>
  );
};

export default AssistantPage;
