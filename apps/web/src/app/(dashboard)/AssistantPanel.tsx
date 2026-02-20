"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, ArrowUp, Loader2, Button, Textarea, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@basicsos/ui";
import { trpc } from "@/lib/trpc";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export const AssistantPanel = (): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.assistant.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.answer },
      ]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const text = input.trim();
    if (!text || chatMutation.isPending) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    chatMutation.mutate({ message: text, history });
  };

  return (
    <>
      {/* Floating toggle button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setOpen((o) => !o)}
              size="icon"
              className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-overlay"
              aria-label="Toggle AI Assistant"
            >
              {open ? <X size={20} /> : <Sparkles size={20} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">AI Assistant</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Slide-in panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-96 flex-col rounded-lg bg-white shadow-overlay overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="flex items-center gap-2 bg-white px-4 pb-3 pt-3">
            <span className="font-semibold text-stone-900">AI Assistant</span>
            <span className="ml-auto text-xs text-stone-500">Powered by Claude</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="ml-2 h-7 w-7 text-stone-500 hover:text-stone-700"
            >
              <X size={16} />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex h-80 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-2 pt-8 text-center text-sm text-stone-500">
                <p>Ask about your company data, tasks, meetings, and more.</p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-muted text-stone-900"
                }`}
              >
                {msg.content}
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="self-start rounded-lg bg-muted px-3 py-2 text-sm text-stone-500">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Thinking...
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-end gap-2 pt-3 p-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Ask anything... (Enter to send)"
              rows={1}
              className="flex-1 resize-none rounded-xl bg-muted min-h-0"
            />
            <Button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending}
              size="icon"
            >
              <ArrowUp size={16} />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};
