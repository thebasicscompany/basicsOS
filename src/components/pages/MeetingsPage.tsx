import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingCard } from "@/components/meetings/MeetingCard";
import { MeetingDetailDialog } from "@/components/meetings/MeetingDetailDialog";
import { useMeetings } from "@/hooks/use-meetings";
import { usePageTitle } from "@/contexts/page-header";

const PER_PAGE = 25;

export function MeetingsPage() {
  usePageTitle("Meetings");
  const [page, setPage] = useState(1);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(
    null,
  );

  const { data: meetings, isPending } = useMeetings({ page, perPage: PER_PAGE });

  return (
    <div className="flex h-full flex-col gap-5 pb-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Cmd+Alt+Space</kbd> to start recording a meeting.
        </p>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : !meetings || meetings.length === 0 ? (
        <div className="rounded-lg bg-muted/50 py-12 text-center text-sm text-muted-foreground">
          No meetings yet. Press Cmd+Alt+Space to start recording.
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onClick={() => setSelectedMeetingId(meeting.id)}
              />
            ))}
          </div>
          {meetings.length >= PER_PAGE && (
            <div className="flex items-center justify-end">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <MeetingDetailDialog
        meetingId={selectedMeetingId}
        open={selectedMeetingId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMeetingId(null);
        }}
      />
    </div>
  );
}
