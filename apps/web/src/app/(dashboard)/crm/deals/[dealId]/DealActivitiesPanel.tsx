"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  addToast,
} from "@basicsos/ui";
import { MessageSquare, Mail, Phone, Video } from "@basicsos/ui";

type ActivityType = "note" | "email" | "call" | "meeting";

const ACTIVITY_ICON: Record<ActivityType, React.ElementType> = {
  note: MessageSquare,
  email: Mail,
  call: Phone,
  meeting: Video,
};

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  note: "Note",
  email: "Email",
  call: "Call",
  meeting: "Meeting",
};

interface DealActivitiesPanelProps {
  dealId: string;
  activities: Array<{
    id: string;
    type: string;
    content: string;
    meetingId: string | null;
    createdAt: Date | string;
  }>;
}

export const DealActivitiesPanel = ({
  dealId,
  activities,
}: DealActivitiesPanelProps): JSX.Element => {
  const utils = trpc.useUtils();
  const [content, setContent] = useState("");
  const [type, setType] = useState<ActivityType>("note");

  const createActivity = trpc.crm.activities.create.useMutation({
    onSuccess: () => {
      addToast({ title: "Activity logged", variant: "success" });
      setContent("");
      void utils.crm.deals.get.invalidate({ id: dealId });
    },
    onError: (err) => {
      addToast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!content.trim()) return;
    createActivity.mutate({ dealId, type, content: content.trim() });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Activities</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ActivityTimeline activities={activities} />
        <AddActivityForm
          content={content}
          type={type}
          isPending={createActivity.isPending}
          onContentChange={setContent}
          onTypeChange={setType}
          onSubmit={handleSubmit}
        />
      </CardContent>
    </Card>
  );
};

function ActivityTimeline({
  activities,
}: {
  activities: DealActivitiesPanelProps["activities"];
}): JSX.Element {
  if (activities.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-stone-500 dark:text-stone-400">
        No activities yet
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activities.map((a) => {
        const Icon = ACTIVITY_ICON[a.type as ActivityType] ?? MessageSquare;
        return (
          <div key={a.id} className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-700">
              <Icon className="size-3.5 text-stone-500 dark:text-stone-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  {ACTIVITY_LABEL[a.type as ActivityType] ?? a.type}
                </span>
                <span className="text-[10px] text-stone-400 dark:text-stone-500">
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300 whitespace-pre-wrap">
                {a.content}
              </p>
              {a.meetingId && (
                <a
                  href={`/meetings/${a.meetingId}`}
                  className="mt-1 inline-block text-xs text-primary hover:underline"
                >
                  View meeting
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddActivityForm({
  content,
  type,
  isPending,
  onContentChange,
  onTypeChange,
  onSubmit,
}: {
  content: string;
  type: ActivityType;
  isPending: boolean;
  onContentChange: (v: string) => void;
  onTypeChange: (v: ActivityType) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}): JSX.Element {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex gap-2">
        <Select value={type} onValueChange={(v) => onTypeChange(v as ActivityType)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="note">Note</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          placeholder="Add a note..."
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          className="min-h-[60px] flex-1"
        />
      </div>
      <Button type="submit" size="sm" className="self-end" disabled={isPending || !content.trim()}>
        {isPending ? "Saving..." : "Log Activity"}
      </Button>
    </form>
  );
}
