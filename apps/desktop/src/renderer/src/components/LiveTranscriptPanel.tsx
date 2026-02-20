import { useState, useEffect, useRef } from "react";
import { Radio, ArrowRight } from "lucide-react";
import { trpcCall } from "../api";
import { sendIPC } from "../lib/ipc";

type TranscriptChunk = { speaker: string; text: string; timestampMs: number };

interface LiveTranscriptPanelProps {
  meetingId: string;
  title: string;
}

export const LiveTranscriptPanel = ({
  meetingId,
  title,
}: LiveTranscriptPanelProps): JSX.Element => {
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
    <div className="mx-4 mb-3 rounded-xl bg-red-50 border border-red-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-red-200">
        <div className="flex items-center gap-2">
          <Radio size={12} className="text-red-500 animate-pulse" />
          <span className="text-xs font-semibold text-red-600 truncate max-w-[160px]">{title}</span>
        </div>
        <button
          type="button"
          onClick={() => sendIPC("navigate-main", `/meetings/${meetingId}`)}
          className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
        >
          Open <ArrowRight size={10} />
        </button>
      </div>

      <div ref={transcriptRef} className="px-3 py-2 max-h-36 overflow-y-auto space-y-1">
        {chunks.length === 0 ? (
          <p className="text-xs text-stone-400 italic">Waiting for transcript...</p>
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
