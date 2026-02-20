import { useState, useEffect } from "react";
import { Calendar, ArrowRight, Loader2, Video, Button, Badge, EmptyState } from "@basicsos/ui";
import { trpcCall } from "../api";
import { sendIPC } from "../lib/ipc";
import { LiveTranscriptPanel } from "../components/LiveTranscriptPanel";

type Meeting = {
  id: string;
  title: string;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
};

export const MeetingsTab = (): JSX.Element => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const data = await trpcCall<Meeting[]>("meetings.list", { limit: 5 }, "query");
        if (!cancelled) {
          setMeetings(data);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="px-4 py-6 text-center text-stone-400 text-sm flex items-center justify-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading meetings...
      </div>
    );
  }

  const liveMeeting = meetings.find((m) => m.startedAt !== null && m.endedAt === null);

  if (meetings.length === 0) {
    return (
      <EmptyState
        Icon={Video}
        heading="No recent meetings"
        className="py-10"
        action={
          <Button
            variant="link"
            className="gap-1"
            onClick={() => sendIPC("navigate-main", "/meetings/new")}
          >
            Start one <ArrowRight size={12} />
          </Button>
        }
      />
    );
  }

  return (
    <div className="pb-4 space-y-2">
      {liveMeeting && (
        <LiveTranscriptPanel meetingId={liveMeeting.id} title={liveMeeting.title} />
      )}

      <div className="px-4 space-y-2">
        <div className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-2">
          {liveMeeting ? "Other Meetings" : "Recent Meetings"}
        </div>
        {meetings.map((m) => {
          const when = m.startedAt ? new Date(m.startedAt).toLocaleDateString() : "No date";
          const isLive = m.startedAt !== null && m.endedAt === null;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => sendIPC("navigate-main", `/meetings/${m.id}`)}
              className="w-full flex items-start gap-3 rounded-xl bg-white border border-stone-200 hover:border-stone-300 hover:shadow-sm px-3 py-3 transition-all text-left"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5 ${isLive ? "bg-red-50 text-red-500" : "bg-stone-100 text-stone-400"}`}>
                <Calendar size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-900 truncate">{m.title}</span>
                  {isLive && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 animate-pulse">
                      LIVE
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-stone-400 mt-0.5">
                  {isLive ? "Recording in progress" : when}
                </div>
              </div>
              <ArrowRight size={14} className="ml-auto text-stone-300 self-center shrink-0" />
            </button>
          );
        })}
        <Button
          variant="link"
          className="w-full text-xs pt-1"
          onClick={() => sendIPC("navigate-main", "/meetings")}
        >
          View all meetings
        </Button>
      </div>
    </div>
  );
};
