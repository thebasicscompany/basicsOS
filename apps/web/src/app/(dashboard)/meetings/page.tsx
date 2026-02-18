import { db } from "@basicsos/db";
import { meetings, meetingSummaries } from "@basicsos/db";
import { eq } from "drizzle-orm";

const MeetingsPage = async (): Promise<JSX.Element> => {
  let meetingList: Array<{ id: string; title: string; startedAt: Date | null; endedAt: Date | null }> = [];
  try {
    meetingList = await db.select({ id: meetings.id, title: meetings.title, startedAt: meetings.startedAt, endedAt: meetings.endedAt }).from(meetings);
  } catch { /* DB not connected */ }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">+ New Meeting</button>
      </div>
      {meetingList.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-gray-500">No meetings recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetingList.map(m => (
            <a key={m.id} href={`/meetings/${m.id}`} className="rounded-xl border bg-white p-5 hover:shadow-sm transition block">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{m.title}</h3>
                  {m.startedAt && <p className="mt-1 text-sm text-gray-500">{new Date(m.startedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>}
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">Completed</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default MeetingsPage;
