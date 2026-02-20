"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { addToast, Button } from "@basicsos/ui";
import { TranscriptDisplay } from "./TranscriptDisplay";
import { SummaryCard } from "./SummaryCard";

// Next.js page requires default export
const MeetingDetailPage = (): JSX.Element => {
  const params = useParams();
  const id = params["id"] as string;
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<string>("Ready to record");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: meeting, refetch } = trpc.meetings.get.useQuery({ id });

  const uploadTranscript = trpc.meetings.uploadTranscript.useMutation({
    onSuccess: () => {
      addToast({ title: "Transcript saved", variant: "success" });
      void refetch();
    },
    onError: (err) => {
      addToast({
        title: "Failed to save transcript",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const processMeeting = trpc.meetings.process.useMutation({
    onSuccess: () => {
      addToast({ title: "Processing started", description: "AI summary will be ready shortly." });
      void refetch();
    },
    onError: (err) => {
      addToast({ title: "Failed to process", description: err.message, variant: "destructive" });
    },
  });

  const sendChunk = async (): Promise<void> => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];

    const reader = new FileReader();
    reader.onload = async (): Promise<void> => {
      const base64 = (reader.result as string).split(",")[1] ?? "";
      if (!base64) return;
      try {
        const res = await fetch("/api/trpc/meetings.transcribeAudio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: { meetingId: id, audioChunk: base64, format: "webm" } }),
        });
        const data = (await res.json()) as {
          result?: { data?: { transcript: string | null; configured: boolean } };
        };
        if (!data.result?.data?.configured) {
          setStatus("Add DEEPGRAM_API_KEY to .env to enable AI transcription");
        }
      } catch {
        // Silently ignore chunk send failures
      }
    };
    reader.readAsDataURL(blob);
  };

  const startRecording = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent): void => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start();
      setIsRecording(true);
      setStatus("Recording…");

      chunkIntervalRef.current = setInterval(() => {
        void sendChunk();
      }, 5000);
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const stopRecording = (): void => {
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setStatus("Recording stopped");
    void sendChunk();
  };

  const handleSaveTranscript = (): void => {
    if (!meeting?.transcripts || meeting.transcripts.length === 0) return;
    const text = meeting.transcripts.map((t) => `${t.speaker}: ${t.text}`).join("\n");
    uploadTranscript.mutate({ meetingId: id, transcriptText: text });
  };

  const handleProcess = (): void => {
    processMeeting.mutate({ meetingId: id });
  };

  const transcripts = meeting?.transcripts ?? [];
  const summaries = meeting?.summaries ?? [];
  const latestSummary = summaries[0];
  const summaryJson =
    (latestSummary?.summaryJson as {
      decisions?: string[];
      actionItems?: string[];
      followUps?: string[];
      note?: string;
    } | null) ?? null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <a href="/meetings" className="text-sm text-stone-500 hover:text-stone-700">
            ← Meetings
          </a>
          <h1 className="mt-1 text-2xl font-bold text-stone-900">
            {meeting?.title ?? "Meeting Recording"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {transcripts.length > 0 && summaries.length === 0 && (
            <Button variant="outline" onClick={handleProcess} disabled={processMeeting.isPending}>
              {processMeeting.isPending ? "Processing…" : "Generate Summary"}
            </Button>
          )}
          <Button
            onClick={isRecording ? stopRecording : () => void startRecording()}
            variant={isRecording ? "destructive" : "default"}
          >
            {isRecording ? "⏹ Stop" : "⏺ Record"}
          </Button>
        </div>
      </div>

      <p className="mb-4 text-sm text-stone-500">{status}</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Transcript */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-700">Transcript</h2>
            {transcripts.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveTranscript}
                disabled={uploadTranscript.isPending}
              >
                Save
              </Button>
            )}
          </div>
          <TranscriptDisplay
            chunks={transcripts.map((t) => ({
              id: t.id,
              speaker: t.speaker,
              text: t.text,
              timestampMs: t.timestampMs,
            }))}
          />
        </div>

        {/* Summary */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-stone-700">Summary</h2>
          <SummaryCard summaryJson={summaryJson} isPending={processMeeting.isPending} />
        </div>
      </div>
    </div>
  );
};

export default MeetingDetailPage;
