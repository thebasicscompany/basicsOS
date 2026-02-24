"use client";

import { Card, EmptyState, ChatCircle } from "@basicsos/ui";

interface TranscriptChunk {
  id: string;
  speaker: string;
  text: string;
  timestampMs: number;
}

const formatTimestamp = (ms: number): string => {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

interface TranscriptDisplayProps {
  chunks: TranscriptChunk[];
}

export const TranscriptDisplay = ({ chunks }: TranscriptDisplayProps): JSX.Element => {
  if (chunks.length === 0) {
    return (
      <EmptyState
        Icon={ChatCircle}
        heading="No transcript"
        description="No transcript available"
      />
    );
  }

  return (
    <div className="space-y-3">
      {chunks.map((chunk) => (
        <Card key={chunk.id} className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{chunk.speaker}</span>
            {chunk.timestampMs > 0 && (
              <span className="text-xs text-stone-500 dark:text-stone-400">{formatTimestamp(chunk.timestampMs)}</span>
            )}
          </div>
          <p className="text-sm text-stone-900 dark:text-stone-100">{chunk.text}</p>
        </Card>
      ))}
    </div>
  );
};
