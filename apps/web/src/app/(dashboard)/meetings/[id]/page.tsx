"use client";

import { useState, useRef, use } from "react";
import { Record, Stop, Microphone } from "@phosphor-icons/react";

type TranscriptLine = { speaker: string; text: string; timestamp: number };

// Next.js page requires default export
const MeetingDetailPage = ({ params }: { params: Promise<{ id: string }> }): JSX.Element => {
  const { id } = use(params);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [status, setStatus] = useState<string>("Ready to record");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendChunk = async (): Promise<void> => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1] ?? "";
      if (!base64) return;

      try {
        const res = await fetch("/api/trpc/meetings.transcribeAudio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: { meetingId: id, audioChunk: base64, format: "webm" } }),
        });
        const data = await res.json() as { result?: { data?: { transcript: string | null; message: string | null; configured: boolean } } };
        const result = data.result?.data;
        if (result?.transcript) {
          setTranscriptLines(prev => [...prev, {
            speaker: "You",
            text: result.transcript ?? "",
            timestamp: Date.now(),
          }]);
        }
        if (!result?.configured) {
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
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start();
      setIsRecording(true);
      setStatus("Recording...");

      // Send audio chunks every 5 seconds for real-time transcription
      chunkIntervalRef.current = setInterval(() => {
        void sendChunk();
      }, 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Error: ${msg}`);
    }
  };

  const stopRecording = (): void => {
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setStatus("Recording stopped");
    // Send final chunk
    void sendChunk();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <a href="/meetings" className="text-sm text-gray-500 hover:text-gray-700">← Meetings</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Meeting Recording</h1>
        </div>
        <button
          onClick={isRecording ? stopRecording : () => void startRecording()}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition ${
            isRecording
              ? "bg-red-500 hover:bg-red-600"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {isRecording ? <Stop size={18} /> : <Record size={18} />}
          <span>{isRecording ? "Stop" : "Record"}</span>
        </button>
      </div>

      {/* Status */}
      <div className="mb-4 text-sm text-gray-500">{status}</div>

      {/* Live transcript */}
      {transcriptLines.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-700">Transcript</h2>
          {transcriptLines.map((line, i) => (
            <div key={i} className="rounded-xl bg-white border p-4">
              <div className="text-xs text-gray-400 mb-1">{line.speaker}</div>
              <p className="text-gray-900">{line.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="mb-3 flex justify-center">
            <Microphone size={48} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">Click "Record" to start capturing</p>
          <p className="text-sm text-gray-400 mt-1">
            {isRecording ? "Listening... transcript will appear here" : "Microphone access required"}
          </p>
        </div>
      )}
    </div>
  );
};

export default MeetingDetailPage;
