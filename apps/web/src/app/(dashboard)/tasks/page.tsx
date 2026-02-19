"use client";

import { trpc } from "@/lib/trpc";

const columns = ["todo", "in-progress", "done"] as const;
const colLabels: Record<string, string> = { "todo": "To Do", "in-progress": "In Progress", "done": "Done" };
const colColors: Record<string, string> = { "todo": "border-gray-300", "in-progress": "border-blue-400", "done": "border-green-400" };
const priorityColors: Record<string, string> = { urgent: "text-red-600 bg-red-50", high: "text-orange-600 bg-orange-50", medium: "text-yellow-600 bg-yellow-50", low: "text-gray-600 bg-gray-50" };

// Next.js App Router requires default exports for page segments.
const TasksPage = (): JSX.Element => {
  const { data: taskList, isLoading } = trpc.tasks.list.useQuery({});

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">Loading Tasks...</div>;
  }

  const tasks = taskList ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">+ New Task</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {columns.map(col => (
          <div key={col}>
            <div className={`mb-3 border-t-2 pt-3 ${colColors[col]}`}>
              <h2 className="font-semibold text-gray-700">
                {colLabels[col]} <span className="ml-1 text-sm text-gray-400">({tasks.filter(t => t.status === col).length})</span>
              </h2>
            </div>
            <div className="space-y-2">
              {tasks.filter(t => t.status === col).map(task => (
                <div key={task.id} className="rounded-lg border bg-white p-3 shadow-sm">
                  <div className="text-sm font-medium text-gray-900">{task.title}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority] ?? ""}`}>{task.priority}</span>
                    {task.dueDate && <span className="text-xs text-gray-500">Due {new Date(task.dueDate).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TasksPage;
