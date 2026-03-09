import { useCallback, useRef } from "react";
import { format } from "date-fns";
import {
  PhoneIcon,
  VideoCameraIcon,
  UsersIcon,
  ClockIcon,
  SquareIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import { useCreateNote } from "@/hooks/use-notes";
import { type MockCall } from "./mock-data/calls";

const TYPE_LABEL = {
  call: "Phone call",
  meeting: "Meeting",
  video: "Video call",
} as const;

const TYPE_ICON = {
  call: PhoneIcon,
  meeting: UsersIcon,
  video: VideoCameraIcon,
} as const;

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface CallViewDialogProps {
  call: MockCall | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectSlug: string;
  recordId: number;
  onSwitchToTab?: (tab: string) => void;
}

export function CallViewDialog({
  call,
  open,
  onOpenChange,
  objectSlug,
  recordId,
  onSwitchToTab,
}: CallViewDialogProps) {
  const createNote = useCreateNote(objectSlug);
  const noteCreatedRef = useRef(false);

  const handleSeeNote = useCallback(async () => {
    if (!call) return;
    if (!noteCreatedRef.current) {
      try {
        await createNote.mutateAsync({
          recordId,
          title: call.title,
          text: call.summary,
        });
        noteCreatedRef.current = true;
      } catch {
        // ignore
      }
    }
    onOpenChange(false);
    onSwitchToTab?.("notes");
  }, [call, recordId, createNote, onOpenChange, onSwitchToTab]);

  if (!call) return null;

  const Icon = TYPE_ICON[call.type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{call.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="outline" className="gap-1.5 px-3 py-1 font-normal">
              <Icon className="size-3.5" />
              {TYPE_LABEL[call.type]}
            </Badge>
            <Badge variant="outline" className="gap-1.5 px-3 py-1 font-normal">
              <ClockIcon className="size-3.5" />
              {formatDuration(call.duration)}
            </Badge>
            <span className="text-sm">
              {format(new Date(call.date), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Participants
            </h4>
            <div className="flex flex-wrap gap-2">
              {call.participants.map((p) => (
                <div
                  key={p.email}
                  className="flex items-center gap-2 rounded-full border px-3 py-1.5"
                >
                  <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                    {p.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <span className="text-sm">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Summary
              </h4>
              {onSwitchToTab && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto gap-1 p-0 text-xs"
                  onClick={handleSeeNote}
                  disabled={createNote.isPending}
                >
                  See meeting note
                  <ArrowRightIcon className="size-3" />
                </Button>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <MarkdownContent>{call.summary}</MarkdownContent>
            </div>
          </div>

          {call.actionItems.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Action items
                </h4>
                {onSwitchToTab && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto gap-1 p-0 text-xs"
                    onClick={() => {
                      onOpenChange(false);
                      onSwitchToTab("tasks");
                    }}
                  >
                    See all tasks
                    <ArrowRightIcon className="size-3" />
                  </Button>
                )}
              </div>
              <div className="space-y-2.5">
                {call.actionItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <SquareIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
