"use client";

import { trpc } from "@/lib/trpc";
import { addToast, Switch, PageHeader, Card, BookOpen, Users, CheckSquare, Video, Link2, Bot, Zap } from "@basicsos/ui";
import type { ComponentType, SVGProps } from "react";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

const MODULE_ICONS: Record<string, { Icon: LucideIcon }> = {
  knowledge: { Icon: BookOpen },
  crm: { Icon: Users },
  tasks: { Icon: CheckSquare },
  meetings: { Icon: Video },
  hub: { Icon: Link2 },
  "ai-employees": { Icon: Bot },
  automations: { Icon: Zap },
};

// Next.js App Router requires default export — framework exception
const ModulesPage = (): JSX.Element => {
  const utils = trpc.useUtils();
  const { data: modules, isLoading } = trpc.modules.list.useQuery();

  const setEnabled = trpc.modules.setEnabled.useMutation({
    onSuccess: (data) => {
      void utils.modules.list.invalidate();
      addToast({
        title: `${data.moduleName} ${data.enabled ? "enabled" : "disabled"}`,
        variant: "success",
      });
    },
    onError: (err) =>
      addToast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Modules"
        description="Enable or disable modules for your workspace."
        className="mb-6"
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-stone-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-lg bg-stone-200 animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 rounded bg-stone-200 animate-pulse" />
                    <div className="h-3 w-40 rounded bg-stone-200 animate-pulse" />
                  </div>
                </div>
                <div className="h-6 w-11 rounded-full bg-stone-200 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {(modules ?? []).map((module) => (
              <div key={module.name} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  {(() => {
                    const ModuleIcon = MODULE_ICONS[module.name]?.Icon ?? BookOpen;
                    return (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-200 text-stone-500">
                        <ModuleIcon size={16} />
                      </div>
                    );
                  })()}
                  <div>
                    <p className="font-medium text-stone-900">{module.displayName}</p>
                    <p className="text-sm text-stone-500">{module.description}</p>
                  </div>
                </div>
                <Switch
                  checked={module.enabled}
                  onCheckedChange={(checked) =>
                    setEnabled.mutate({
                      moduleName: module.name,
                      enabled: checked,
                    })
                  }
                  disabled={setEnabled.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ModulesPage;
