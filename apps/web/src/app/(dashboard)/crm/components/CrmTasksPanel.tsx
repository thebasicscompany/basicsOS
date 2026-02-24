"use client";

import { useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Badge,
  EmptyState,
  addToast,
  CheckSquare,
  Plus,
  Check,
} from "@basicsos/ui";

interface CrmTasksPanelProps {
  entityType: "contact" | "company" | "deal";
  entityId: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-stone-100 text-stone-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const formatDueDate = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

interface AddTaskFormProps {
  entityType: "contact" | "company" | "deal";
  entityId: string;
  onCreated: () => void;
  onCancel: () => void;
}

const AddTaskForm = ({ entityType, entityId, onCreated, onCancel }: AddTaskFormProps): JSX.Element => {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      addToast({ title: "Task created", variant: "success" });
      onCreated();
    },
    onError: (err) => {
      addToast({ title: "Failed to create task", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      relatedEntityType: entityType,
      relatedEntityId: entityId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-3 pt-3 border-t border-stone-200">
      <Input
        placeholder="Task title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        className="text-sm"
      />
      <Input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={!title.trim() || createMutation.isPending}
          className="flex-1"
        >
          {createMutation.isPending ? "Adding…" : "Add Task"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

export const CrmTasksPanel = ({ entityType, entityId }: CrmTasksPanelProps): JSX.Element => {
  const utils = trpc.useUtils();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: tasks = [], isLoading } = trpc.tasks.listByEntity.useQuery({
    entityType,
    entityId,
  });

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      void utils.tasks.listByEntity.invalidate({ entityType, entityId });
    },
    onError: (err) => {
      addToast({ title: "Failed to update task", description: err.message, variant: "destructive" });
    },
  });

  const handleToggleComplete = (taskId: string, currentStatus: string): void => {
    const newStatus = currentStatus === "done" ? "todo" : "done";
    updateMutation.mutate({ id: taskId, status: newStatus });
  };

  const handleCreated = (): void => {
    void utils.tasks.listByEntity.invalidate({ entityType, entityId });
    setShowAddForm(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            {tasks.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                {tasks.length}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-stone-500"
            onClick={() => setShowAddForm((v) => !v)}
          >
            <Plus size={13} />
            Add Task
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading && (
          <p className="text-sm text-stone-400 py-2">Loading tasks…</p>
        )}

        {!isLoading && tasks.length === 0 && !showAddForm && (
          <EmptyState
            Icon={CheckSquare}
            heading="No tasks yet"
            description="Add a task to track work linked to this record."
          />
        )}

        {!isLoading && tasks.length > 0 && (
          <ul className="flex flex-col divide-y divide-stone-100">
            {tasks.map((task) => {
              const isDone = task.status === "done";
              const dueDateStr = formatDueDate(task.dueDate);
              return (
                <li key={task.id} className="flex items-start gap-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleComplete(task.id, task.status)}
                    aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                    className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-stone-300 transition-colors hover:border-primary"
                    style={{ background: isDone ? "var(--color-primary)" : undefined, borderColor: isDone ? "var(--color-primary)" : undefined }}
                  >
                    {isDone && <Check size={10} className="text-white" />}
                  </button>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={`text-sm leading-snug ${isDone ? "text-stone-400 line-through" : "text-stone-900"}`}
                    >
                      {task.title}
                    </span>
                    <div className="flex items-center gap-2">
                      {dueDateStr && (
                        <span className="text-xs text-stone-400">{dueDateStr}</span>
                      )}
                      <Badge
                        className={`text-[10px] px-1.5 py-0 h-4 ${PRIORITY_COLORS[task.priority] ?? ""}`}
                      >
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {showAddForm && (
          <AddTaskForm
            entityType={entityType}
            entityId={entityId}
            onCreated={handleCreated}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </CardContent>
    </Card>
  );
};
