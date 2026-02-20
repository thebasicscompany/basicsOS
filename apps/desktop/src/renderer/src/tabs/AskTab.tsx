import { useState, useEffect, useRef } from "react";
import { Search, Loader2, CheckSquare, Users, Video, BookOpen, ArrowRight, Sparkles, Input, Button, SectionLabel } from "@basicsos/ui";
import { trpcCall } from "../api";
import { sendIPC } from "../lib/ipc";

export const AskTab = (): JSX.Element => {
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
    { label: "New Task", Icon: CheckSquare, path: "/tasks" },
    { label: "CRM", Icon: Users, path: "/crm" },
    { label: "Meetings", Icon: Video, path: "/meetings" },
    { label: "Knowledge", Icon: BookOpen, path: "/knowledge" },
  ];

  const openInMain = (path: string): void => {
    sendIPC("navigate-main", path);
  };

  return (
    <>
      <form onSubmit={(e) => void handleAsk(e)} className="px-4 pb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about company data..."
            className="pl-9 rounded-xl py-2.5"
          />
        </div>
      </form>

      {(loading || answer) && (
        <div className="mx-4 mb-3 rounded-xl bg-stone-200 p-3 text-sm text-stone-700 max-h-32 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-stone-500">
              <Loader2 size={14} className="animate-spin" /> Thinking...
            </div>
          ) : (
            answer
          )}
        </div>
      )}

      <div className="px-4 pb-2">
        <SectionLabel className="mb-2">Quick Actions</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="justify-start gap-2 rounded-xl px-3 py-2.5 h-auto"
              onClick={() => openInMain(action.path)}
            >
              <action.Icon size={15} className="text-stone-500" />
              <span>{action.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        <Button
          className="w-full justify-between rounded-xl py-3 h-auto"
          onClick={() => openInMain("/")}
        >
          <span className="flex items-center gap-2">
            <Sparkles size={14} />
            Open Basics OS Dashboard
          </span>
          <ArrowRight size={14} className="opacity-60" />
        </Button>
      </div>
    </>
  );
};
