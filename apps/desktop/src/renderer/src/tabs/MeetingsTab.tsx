import { useState, useEffect } from "react";
import { Calendar, ArrowRight, Loader2, Video } from "lucide-react";
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
      <div className="px-4 py-10 flex flex-col items-center text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-400 mb-3">
          <Video size={20} />
        </div>
        <p className="text-sm text-stone-500">No recent meetings</p>
        <button
          type="button"
          onClick={() => sendIPC("navigate-main", "/meetings/new")}
          className="flex items-center gap-1 text-sm text-primary hover:underline mt-2"
        >
          Start one <ArrowRight size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="pb-4 space-y-2">
      {liveMeeting && <LiveTranscriptPanel meetingId={liveMeeting.id} title={liveMeeting.title} />}

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
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5 ${isLive ? "bg-red-50 text-red-500" : "bg-stone-100 text-stone-400"}`}
              >
                {isLive ? <Calendar size={15} /> : <Calendar size={15} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-900 truncate">{m.title}</span>
                  {isLive && (
                    <span className="text-[10px] font-semibold bg-red-50 border border-red-200 text-red-600 px-1.5 py-0.5 rounded-full shrink-0 animate-pulse">
                      LIVE
                    </span>
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
        <button
          type="button"
          onClick={() => sendIPC("navigate-main", "/meetings")}
          className="block w-full text-center text-xs text-primary hover:underline pt-1"
        >
          View all meetings
        </button>
      </div>
    </div>
  );
};
