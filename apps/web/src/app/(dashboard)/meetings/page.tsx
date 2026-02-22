"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { addToast } from "@basicsos/ui";
import {
  Button,
  Badge,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  Input,
  Label,
  Plus,
  Video,
  EmptyState,
  PageHeader,
} from "@basicsos/ui";

const CreateMeetingDialog = ({ onCreated }: { onCreated?: (id: string) => void }): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const createMeeting = trpc.meetings.create.useMutation({
    onSuccess: (meeting) => {
      setOpen(false);
      setTitle("");
      onCreated?.(meeting.id);
    },
    onError: (err) => {
      addToast({
        title: "Failed to create meeting",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!title.trim()) return;
    createMeeting.mutate({ title: title.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={14} className="mr-1" /> New Meeting
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Meeting</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meeting-title">Title</Label>
            <Input
              id="meeting-title"
              placeholder="Meeting title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMeeting.isPending}>
              {createMeeting.isPending ? "Creating..." : "Create Meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Next.js App Router requires default export — framework exception.
const MeetingsPage = (): JSX.Element => {
  const router = useRouter();
  const { data: meetingList } = trpc.meetings.list.useQuery({ limit: 50 });

  return (
    <div>
      <PageHeader
        title="Meetings"
        className="mb-6"
        action={<CreateMeetingDialog onCreated={(id) => router.push(`/meetings/${id}`)} />}
      />
      {(meetingList ?? []).length === 0 ? (
        <EmptyState
          Icon={Video}
          heading="No meetings recorded yet"
          description="Create a meeting to start capturing notes and summaries."
          action={<CreateMeetingDialog onCreated={(id) => router.push(`/meetings/${id}`)} />}
        />
      ) : (
        <div className="space-y-3">
          {(meetingList ?? []).map((m) => (
            <a key={m.id} href={`/meetings/${m.id}`} className="block">
              <Card className="p-4 transition-colors hover:bg-accent/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-foreground line-clamp-1">{m.title}</h3>
                    {m.startedAt !== null && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(m.startedAt).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <Badge variant="success" className="shrink-0">Completed</Badge>
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default MeetingsPage;
