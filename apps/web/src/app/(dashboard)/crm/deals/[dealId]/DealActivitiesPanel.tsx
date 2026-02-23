"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Textarea,
  addToast,
  SectionLabel,
  Mail,
  MessageSquare,
  Phone,
  Video,
  Plus,
} from "@basicsos/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivityType = "note" | "email" | "call" | "meeting";

interface Activity {
  id: string;
  type: string;
  content: string;
  subject: string | null;
  direction: string | null;
  activityDate: Date | string | null;
  createdAt: Date | string;
}

// ---------------------------------------------------------------------------
// Activity icon helpers
// ---------------------------------------------------------------------------

const ACTIVITY_ICON_MAP: Record<
  ActivityType,
  { icon: React.ComponentType<{ className?: string }>; bg: string; color: string }
> = {
  note: {
    icon: MessageSquare,
    bg: "bg-stone-100 dark:bg-stone-700",
    color: "text-stone-500 dark:text-stone-400",
  },
  email: {
    icon: Mail,
    bg: "bg-blue-50 dark:bg-blue-950",
    color: "text-blue-600 dark:text-blue-400",
  },
  call: {
    icon: Phone,
    bg: "bg-emerald-50 dark:bg-emerald-950",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  meeting: {
    icon: Video,
    bg: "bg-purple-50 dark:bg-purple-950",
    color: "text-purple-600 dark:text-purple-400",
  },
};

function getActivityIconConfig(
  type: string,
): (typeof ACTIVITY_ICON_MAP)[ActivityType] {
  return (
    ACTIVITY_ICON_MAP[type as ActivityType] ?? ACTIVITY_ICON_MAP["note"]
  );
}

// ---------------------------------------------------------------------------
// Activity item renderer
// ---------------------------------------------------------------------------

function ActivityItem({ activity }: { activity: Activity }): JSX.Element {
  const config = getActivityIconConfig(activity.type);
  const Icon = config.icon;
  const displayDate = activity.activityDate ?? activity.createdAt;

  if (activity.type === "email") {
    return (
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${config.bg}`}
        >
          <Icon className={`size-3.5 ${config.color}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
              {activity.subject ?? "Email"}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {activity.direction === "inbound" ? "Received" : "Sent"}
            </Badge>
          </div>
          {activity.content && (
            <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
              {activity.content}
            </p>
          )}
          <span className="text-xs text-stone-400 dark:text-stone-500">
            {new Date(displayDate as string | Date).toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${config.bg}`}
      >
        <Icon className={`size-3.5 ${config.color}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
            {activity.type}
          </span>
          <span className="text-xs text-stone-400 dark:text-stone-500">
            {new Date(displayDate as string | Date).toLocaleString()}
          </span>
        </div>
        {activity.content && (
          <p className="mt-0.5 text-sm text-stone-700 dark:text-stone-300">
            {activity.content}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Log Email dialog
// ---------------------------------------------------------------------------

interface LogEmailDialogProps {
  dealId: string;
  onLogged: () => void;
}

function LogEmailDialog({ dealId, onLogged }: LogEmailDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [content, setContent] = useState("");
  const [activityDate, setActivityDate] = useState(() => {
    const now = new Date();
    // Format for datetime-local input: YYYY-MM-DDTHH:mm
    const pad = (n: number): string => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });

  const logEmail = trpc.crm.activities.logEmail.useMutation({
    onSuccess: () => {
      addToast({ title: "Email logged", variant: "success" });
      setOpen(false);
      setSubject("");
      setContent("");
      setDirection("outbound");
      onLogged();
    },
    onError: (err) => {
      addToast({ title: "Failed to log email", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!subject.trim()) return;
    logEmail.mutate({
      dealId,
      subject: subject.trim(),
      content: content.trim(),
      direction,
      activityDate: new Date(activityDate).toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail size={14} className="mr-1.5" />
          Log Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Email</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Subject <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Direction
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection("outbound")}
                className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  direction === "outbound"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-stone-200 bg-transparent text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                }`}
              >
                Sent
              </button>
              <button
                type="button"
                onClick={() => setDirection("inbound")}
                className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  direction === "inbound"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-stone-200 bg-transparent text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                }`}
              >
                Received
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Snippet (optional)
            </label>
            <Textarea
              placeholder="Email content or notes..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Date
            </label>
            <Input
              type="datetime-local"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={logEmail.isPending || !subject.trim()}
            >
              {logEmail.isPending ? "Logging…" : "Log Email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Add Note inline form
// ---------------------------------------------------------------------------

interface AddNoteFormProps {
  dealId: string;
  onAdded: () => void;
}

function AddNoteForm({ dealId, onAdded }: AddNoteFormProps): JSX.Element {
  const [note, setNote] = useState("");

  const createActivity = trpc.crm.activities.create.useMutation({
    onSuccess: () => {
      addToast({ title: "Note added", variant: "success" });
      setNote("");
      onAdded();
    },
    onError: (err) => {
      addToast({ title: "Failed to add note", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!note.trim()) return;
    createActivity.mutate({ dealId, type: "note", content: note.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea
        placeholder="Add a note..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="resize-none text-sm"
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={createActivity.isPending || !note.trim()}
        >
          <Plus size={14} className="mr-1" />
          Add Note
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// DealActivitiesPanel
// ---------------------------------------------------------------------------

interface DealActivitiesPanelProps {
  dealId: string;
}

export function DealActivitiesPanel({ dealId }: DealActivitiesPanelProps): JSX.Element {
  const utils = trpc.useUtils();

  const { data: activities, isLoading } = trpc.crm.activities.list.useQuery({ dealId });

  const handleRefresh = (): void => {
    void utils.crm.activities.list.invalidate({ dealId });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-stone-900 dark:text-stone-100">
            Activity
          </CardTitle>
          <LogEmailDialog dealId={dealId} onLogged={handleRefresh} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AddNoteForm dealId={dealId} onAdded={handleRefresh} />

        {isLoading && (
          <p className="text-sm text-stone-400 dark:text-stone-500">Loading activities…</p>
        )}

        {!isLoading && (activities ?? []).length === 0 && (
          <p className="text-sm text-stone-400 dark:text-stone-500">
            No activity yet. Add a note or log an email above.
          </p>
        )}

        {(activities ?? []).length > 0 && (
          <div className="flex flex-col gap-1">
            <SectionLabel>Timeline</SectionLabel>
            <div className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
              {[...(activities ?? [])]
                .sort(
                  (a, b) =>
                    new Date(b.createdAt as string | Date).getTime() -
                    new Date(a.createdAt as string | Date).getTime(),
                )
                .map((activity) => (
                  <div key={activity.id} className="py-3 first:pt-0 last:pb-0">
                    <ActivityItem activity={activity as Activity} />
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
