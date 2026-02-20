"use client";

import { useState } from "react";
import { TaskCard } from "./TaskCard";
import type { TaskStatus, Task } from "./types";

interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  onStatusChanged?: () => void;
}

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  todo: "border-t-stone-300",
  "in-progress": "border-t-primary",
  done: "border-t-success",
};

export const KanbanColumn = ({
  status,
  label,
  tasks,
  onStatusChanged,
}: KanbanColumnProps): JSX.Element => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (): void => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragOver(false);
    e.dataTransfer.setData("targetStatus", status);
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) {
      const event = new CustomEvent("task:move", { detail: { taskId, status } });
      document.dispatchEvent(event);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 min-w-0 rounded-lg transition-colors ${isDragOver ? "bg-primary/5" : ""}`}
    >
      <div className={`mb-3 border-t-2 pt-3 ${COLUMN_ACCENT[status]}`}>
        <h2 className="font-semibold text-stone-700">
          {label}{" "}
          <span className="ml-1 text-sm font-normal text-stone-500">({tasks.length})</span>
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} {...(onStatusChanged ? { onStatusChanged } : {})} />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-stone-200 p-4 text-center text-xs text-stone-500">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
};
