"use client";

import { trpc } from "@/lib/trpc";
import { addToast } from "@basicsos/ui";

// Next.js App Router requires default export — framework exception
const ModulesPage = (): JSX.Element => {
  const { data: modules, isLoading } = trpc.modules.list.useQuery();

  const setEnabled = trpc.modules.setEnabled.useMutation({
    onSuccess: (data) =>
      addToast({
        title: `${data.moduleName} ${data.enabled ? "enabled" : "disabled"}`,
        variant: "success",
      }),
    onError: (err) =>
      addToast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Modules</h1>
        <p className="mt-1 text-sm text-stone-500">Enable or disable modules for your workspace.</p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-stone-400">Loading…</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {(modules ?? []).map((module) => (
              <div key={module.name} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <span className="text-lg">{module.icon}</span>
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">{module.displayName}</p>
                    <p className="text-sm text-stone-500">{module.description}</p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={module.enabled}
                  onClick={() =>
                    setEnabled.mutate({
                      moduleName: module.name,
                      enabled: !module.enabled,
                    })
                  }
                  disabled={setEnabled.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    module.enabled ? "bg-primary" : "bg-stone-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      module.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModulesPage;
