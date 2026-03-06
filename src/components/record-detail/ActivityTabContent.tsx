import { useMemo } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  NoteIcon,
  CheckCircleIcon,
  PhoneIcon,
} from "@phosphor-icons/react";
import { useNotes } from "@/hooks/use-notes";
import { useTasks } from "@/hooks/use-tasks";
import { getMockCalls } from "./mock-data/calls";

interface ActivityItem {
  id: string;
  type: "note" | "task" | "call";
  title: string;
  date: string;
  tab: string;
}

interface ActivityTabContentProps {
  objectSlug: string;
  recordId: number;
  onSwitchToTab?: (tab: string) => void;
}

const TYPE_CONFIG = {
  note: { icon: NoteIcon, label: "Note" },
  task: { icon: CheckCircleIcon, label: "Task" },
  call: { icon: PhoneIcon, label: "Call" },
} as const;

export function ActivityTabContent({
  objectSlug,
  recordId,
  onSwitchToTab,
}: ActivityTabContentProps) {
  const { data: notesData } = useNotes(objectSlug, recordId);
  const { data: tasksData } = useTasks();
  const calls = useMemo(() => getMockCalls(recordId), [recordId]);

  const items = useMemo(() => {
    const result: ActivityItem[] = [];

    // Notes
    const notes = notesData?.data ?? [];
    for (const n of notes) {
      result.push({
        id: `note-${n.id}`,
        type: "note",
        title: n.title || n.text?.slice(0, 80) || "Untitled note",
        date: n.date,
        tab: "notes",
      });
    }

    // Tasks
    const allTasks = tasksData?.data ?? [];
    const recordTasks =
      objectSlug === "contacts"
        ? allTasks.filter((t) => t.contactId === recordId)
        : objectSlug === "companies"
          ? allTasks.filter(
              (t) => (t as Record<string, unknown>).companyId === recordId,
            )
          : [];
    for (const t of recordTasks) {
      result.push({
        id: `task-${t.id}`,
        type: "task",
        title: t.text || "Untitled task",
        date: t.dueDate || new Date().toISOString(),
        tab: "tasks",
      });
    }

    // Calls
    for (const c of calls) {
      result.push({
        id: `call-${c.id}`,
        type: "call",
        title: c.title,
        date: c.date,
        tab: "calls",
      });
    }

    result.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    return result;
  }, [notesData?.data, tasksData?.data, calls, objectSlug, recordId]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border bg-card">
      {items.map((item) => {
        const cfg = TYPE_CONFIG[item.type];
        const Icon = cfg.icon;
        return (
          <button
            key={item.id}
            onClick={() => onSwitchToTab?.(item.tab)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm">
              {item.title}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDistanceToNow(parseISO(item.date), { addSuffix: true })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
