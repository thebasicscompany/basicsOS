"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Input, Label, Card, addToast } from "@basicsos/ui";

// Next.js App Router requires default export — framework exception
const NewMeetingPage = (): JSX.Element => {
  const router = useRouter();
  const [tab, setTab] = useState<"transcript" | "audio">("transcript");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [attendees, setAttendees] = useState("");
  const [transcript, setTranscript] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const createMeeting = trpc.meetings.create.useMutation();
  const uploadTranscript = trpc.meetings.uploadTranscript.useMutation();
  const processMeeting = trpc.meetings.process.useMutation();

  const isPending =
    createMeeting.isPending || uploadTranscript.isPending || processMeeting.isPending;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!title.trim()) {
      addToast({ title: "Title is required", variant: "destructive" });
      return;
    }

    try {
      const participantEmails = attendees
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.includes("@"));

      const meeting = await createMeeting.mutateAsync({
        title: title.trim(),
        startedAt: new Date(date).toISOString(),
        participantEmails,
      });

      if (tab === "transcript" && transcript.trim()) {
        await uploadTranscript.mutateAsync({
          meetingId: meeting.id,
          transcriptText: transcript.trim(),
        });
        await processMeeting.mutateAsync({ meetingId: meeting.id });
        addToast({ title: "Meeting created & processing started", variant: "success" });
      } else {
        addToast({ title: "Meeting created", variant: "success" });
      }

      router.push(`/meetings/${meeting.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create meeting";
      addToast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <a href="/meetings" className="text-sm text-stone-500 hover:text-stone-700">← Meetings</a>
        <h1 className="mt-1 text-2xl font-bold text-stone-900">New Meeting</h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* Core fields */}
        <Card className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Q4 Planning, Weekly Sync…"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">Date & Time</Label>
            <Input
              id="date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="attendees">Attendees (comma-separated emails)</Label>
            <Input
              id="attendees"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="alice@company.com, bob@company.com"
            />
          </div>
        </Card>

        {/* Transcript / Audio tabs */}
        <Card className="overflow-hidden">
          <div className="flex border-b">
            <button
              type="button"
              onClick={() => setTab("transcript")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                tab === "transcript"
                  ? "bg-primary/5 text-primary border-b-2 border-primary"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Paste Transcript
            </button>
            <button
              type="button"
              onClick={() => setTab("audio")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                tab === "audio"
                  ? "bg-primary/5 text-primary border-b-2 border-primary"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Upload Audio
            </button>
          </div>

          <div className="p-6">
            {tab === "transcript" ? (
              <div className="space-y-2">
                <Label htmlFor="transcript">
                  Transcript text (format: <code className="text-xs">Speaker: text</code> per line)
                </Label>
                <textarea
                  id="transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={10}
                  placeholder={"Alice: Welcome everyone to the meeting.\nBob: Thanks for having us..."}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                />
                <p className="text-xs text-stone-400">
                  Optional. Pasting a transcript will trigger AI summarization.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="audio">Audio File</Label>
                <input
                  id="audio"
                  type="file"
                  accept=".mp4,.mp3,.wav,.webm,.m4a"
                  onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-stone-500 file:mr-4 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                />
                {audioFile && (
                  <p className="text-xs text-stone-500">
                    Selected: {audioFile.name} ({Math.round(audioFile.size / 1024)} KB)
                  </p>
                )}
                <p className="text-xs text-stone-400">
                  Requires DEEPGRAM_API_KEY for transcription. Supports .mp4, .mp3, .wav, .webm, .m4a.
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create Meeting"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewMeetingPage;
