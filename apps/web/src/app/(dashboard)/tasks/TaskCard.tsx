"use client";

import { Badge, Card, addToast } from "@basicsos/ui";
import { trpc } from "@/lib/trpc";
import type { TaskStatus, TaskPriority, Task } from "./types";

const PRIORITY_VARIANT: Record<TaskPriority, "destructive" | "warning" | "secondary" | "outline"> =
  {
    urgent: "destructive",
    high: "warning",
    medium: "secondary",
    low: "outline",
  };

interface TaskCardProps {
  task: Task;
  onStatusChanged?: () => void;
}

export const TaskCard = ({ task, onStatusChanged }: TaskCardProps): JSX.Element => {
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      onStatusChanged?.();
    },
    onError: (err) => {
      addToast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>): void => {
    e.dataTransfer.setData("taskId", task.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    const newStatus = e.dataTransfer.getData("targetStatus") as TaskStatus;
    if (newStatus && newStatus !== task.status) {
      updateTask.mutate({ id: task.id, status: newStatus });
    }
  };

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      onDrop={handleDrop}
      className="cursor-grab p-3 active:cursor-grabbing transition-colors hover:bg-stone-50"
    >
      <p className="text-sm font-medium text-stone-900">{task.title}</p>
      <div className="mt-2 flex items-center gap-2">
        <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
        {task.dueDate !== null && task.dueDate !== undefined && (
          <span className="text-xs text-stone-500">
            Due {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </Card>
  );
};
