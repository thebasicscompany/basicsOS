import { useState, useMemo } from "react";
import {
  PlusIcon,
  SquareIcon,
  CheckSquareIcon,
  TrashIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import {
  startOfToday,
  endOfToday,
  endOfTomorrow,
  endOfWeek,
  getDay,
  isWithinInterval,
  parseISO,
  format,
  addDays,
} from "date-fns";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskTypeInput } from "@/components/task-type-input";
import {
  useTasks,
  useCreateTask,
  useMarkTaskDone,
  useDeleteTask,
  type Task,
} from "@/hooks/use-tasks";

function getBucket(
  dueDate: string | null,
): "overdue" | "today" | "tomorrow" | "thisWeek" | "later" {
  if (!dueDate) return "later";
  const date = parseISO(dueDate);
  if (date < startOfToday()) return "overdue";
  if (isWithinInterval(date, { start: startOfToday(), end: endOfToday() }))
    return "today";
  if (isWithinInterval(date, { start: endOfToday(), end: endOfTomorrow() }))
    return "tomorrow";
  const now = new Date();
  const endOfWeekDate = endOfWeek(now, { weekStartsOn: 0 });
  if (getDay(now) < 5 && date <= endOfWeekDate) return "thisWeek";
  return "later";
}

const BUCKETS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "thisWeek", label: "This week" },
  { key: "later", label: "Later" },
] as const;

interface TasksTabContentProps {
  objectSlug: string;
  recordId: number;
}

export function TasksTabContent({
  objectSlug,
  recordId,
}: TasksTabContentProps) {
  const { data: tasksData, isPending } = useTasks();
  const [addOpen, setAddOpen] = useState(false);

  const recordTasks = useMemo(() => {
    const all = tasksData?.data ?? [];
    if (objectSlug === "contacts") {
      return all.filter((t) => t.contactId === recordId);
    }
    if (objectSlug === "companies") {
      return all.filter((t) => (t as Record<string, unknown>).companyId === recordId);
    }
    return [];
  }, [tasksData?.data, objectSlug, recordId]);

  const activeTasks = useMemo(
    () =>
      recordTasks.filter(
        (t) =>
          !t.doneDate ||
          new Date(t.doneDate) > new Date(Date.now() - 5 * 60 * 1000),
      ),
    [recordTasks],
  );

  const grouped = useMemo(() => {
    const groups: Record<string, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
    };
    for (const t of activeTasks) {
      groups[getBucket(t.dueDate)].push(t);
    }
    return groups;
  }, [activeTasks]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {activeTasks.length} task{activeTasks.length !== 1 ? "s" : ""}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAddOpen(true)}
          className="h-7 gap-1 text-xs"
        >
          <PlusIcon className="size-3" />
          Add task
        </Button>
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <CircleNotchIcon className="size-3.5 animate-spin" />
          Loading...
        </div>
      ) : activeTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No tasks yet.
        </div>
      ) : (
        BUCKETS.map(({ key, label }) => {
          const bucket = grouped[key];
          if (!bucket?.length) return null;
          return (
            <div key={key}>
              <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}{" "}
                <span className="text-muted-foreground/60">
                  {bucket.length}
                </span>
              </p>
              <div className="rounded-md border bg-card">
                {bucket.map((task) => (
                  <TaskRowInline key={task.id} task={task} />
                ))}
              </div>
            </div>
          );
        })
      )}

      <AddTaskInlineDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        objectSlug={objectSlug}
        recordId={recordId}
      />
    </div>
  );
}

function TaskRowInline({ task }: { task: Task }) {
  const markDone = useMarkTaskDone();
  const deleteTask = useDeleteTask();
  const isDone = !!task.doneDate;

  return (
    <div className="group flex items-center gap-2 px-3 py-2">
      <button
        onClick={() =>
          markDone.mutate(
            { id: task.id, done: !isDone },
            { onError: (err) => showError(err, "Failed to update task") },
          )
        }
        disabled={markDone.isPending}
        className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
      >
        {isDone ? (
          <CheckSquareIcon className="size-3.5 text-primary" />
        ) : (
          <SquareIcon className="size-3.5" />
        )}
      </button>
      <span
        className={`min-w-0 flex-1 truncate text-sm ${isDone ? "text-muted-foreground line-through" : ""}`}
      >
        {task.text ?? "\u2014"}
      </span>
      {task.type && task.type !== "None" && (
        <Badge variant="outline" className="h-5 shrink-0 text-xs font-normal">
          {task.type}
        </Badge>
      )}
      {task.dueDate && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {format(parseISO(task.dueDate), "MMM d")}
        </span>
      )}
      <button
        onClick={() =>
          deleteTask.mutate(task.id, {
            onSuccess: () => toast.success("Task deleted"),
            onError: () => toast.error("Failed to delete task"),
          })
        }
        disabled={deleteTask.isPending}
        className="shrink-0 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
      >
        <TrashIcon className="size-3" />
      </button>
    </div>
  );
}

function AddTaskInlineDialog({
  open,
  onOpenChange,
  objectSlug,
  recordId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectSlug: string;
  recordId: number;
}) {
  const createTask = useCreateTask();
  const [type, setType] = useState("");
  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const tomorrow = addDays(new Date(), 1).toISOString().slice(0, 10);
  const [dueDate, setDueDate] = useState(tomorrow);

  const handleSubmit = () => {
    if (!text.trim()) {
      toast.error("Enter task text");
      return;
    }

    const data: Record<string, unknown> = {
      type: type.trim() || undefined,
      text: text.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    };

    if (objectSlug === "contacts") {
      data.contactId = recordId;
    } else if (objectSlug === "companies") {
      data.companyId = recordId;
    }

    createTask.mutate(data as Parameters<typeof createTask.mutate>[0], {
      onSuccess: () => {
        toast.success("Task created");
        onOpenChange(false);
        setText("");
        setDescription("");
        setType("");
        setDueDate(tomorrow);
      },
      onError: (err) => showError(err, "Failed to create task"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Task</Label>
            <Input
              placeholder="What needs to be done?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              placeholder="Add more details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <TaskTypeInput
                value={type}
                onChange={setType}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={createTask.isPending}
          >
            {createTask.isPending && (
              <CircleNotchIcon className="mr-1.5 size-3.5 animate-spin" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
