"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Plus, CheckSquare, EmptyState, addToast, PageHeader, Card } from "@basicsos/ui";
import { KanbanColumn } from "./KanbanColumn";
import { CreateTaskDialog } from "./CreateTaskDialog";
import type { TaskStatus, Task } from "./types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "To Do" },
  { status: "in-progress", label: "In Progress" },
  { status: "done", label: "Done" },
];

// Next.js App Router requires default export — framework exception.
const TasksPage = (): JSX.Element => {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.tasks.list.useQuery({});
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      void utils.tasks.list.invalidate();
    },
    onError: (err) => {
      addToast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const taskList = (data ?? []) as Task[];

  useEffect(() => {
    const handler = (e: Event): void => {
      const { taskId, status } = (e as CustomEvent<{ taskId: string; status: TaskStatus }>).detail;
      updateTask.mutate({ id: taskId, status });
    };
    document.addEventListener("task:move", handler);
    return () => document.removeEventListener("task:move", handler);
  }, [updateTask]);

  return (
    <div>
      <PageHeader
        title="Tasks"
        className="mb-6"
        action={
          <CreateTaskDialog onCreated={() => void utils.tasks.list.invalidate()}>
            <Button><Plus size={14} className="mr-1" /> New Task</Button>
          </CreateTaskDialog>
        }
      />

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(({ status }) => (
            <div key={status} className="w-72 flex-shrink-0">
              <div className="rounded-sm bg-muted/40 p-3 space-y-3">
                <div className="h-5 w-24 rounded-sm bg-muted animate-pulse" />
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-20 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : taskList.length === 0 ? (
        <EmptyState
          Icon={CheckSquare}
          heading="No tasks yet"
          description="Create your first task to get started."
          action={
            <CreateTaskDialog onCreated={() => void utils.tasks.list.invalidate()}>
              <Button>
                <Plus size={14} className="mr-1" /> Create Task
              </Button>
            </CreateTaskDialog>
          }
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(({ status, label }) => (
            <div key={status} className="w-72 flex-shrink-0">
              <KanbanColumn
                status={status}
                label={label}
                tasks={taskList.filter((t) => t.status === status)}
                onStatusChanged={() => void utils.tasks.list.invalidate()}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TasksPage;
