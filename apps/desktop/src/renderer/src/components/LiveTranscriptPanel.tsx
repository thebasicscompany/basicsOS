import { useState, useEffect, useRef } from "react";
import { Radio, ArrowRight, Button } from "@basicsos/ui";
import { trpcCall } from "../api";
import { sendIPC } from "../lib/ipc";

type TranscriptChunk = { speaker: string; text: string; timestampMs: number };

interface LiveTranscriptPanelProps {
  meetingId: string;
  title: string;
}

export const LiveTranscriptPanel = ({ meetingId, title }: LiveTranscriptPanelProps): JSX.Element => {
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

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chunks]);

  return (
    <div className="mx-4 mb-3 rounded-xl bg-destructive/5 border border-destructive/20 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-destructive/20">
        <div className="flex items-center gap-2">
          <Radio size={12} className="text-destructive animate-pulse" />
          <span className="text-xs font-semibold text-destructive truncate max-w-[160px]">
            {title}
          </span>
        </div>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs gap-1"
          onClick={() => sendIPC("navigate-main", `/meetings/${meetingId}`)}
        >
          Open <ArrowRight size={10} />
        </Button>
      </div>

      <div ref={transcriptRef} className="px-3 py-2 max-h-36 overflow-y-auto space-y-1">
        {chunks.length === 0 ? (
          <p className="text-xs text-stone-500 italic">Waiting for transcript...</p>
        ) : (
          chunks.map((chunk, i) => (
            <div key={i} className="text-xs leading-relaxed">
              <span className="font-semibold text-primary">{chunk.speaker}: </span>
              <span className="text-stone-600">{chunk.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
