"use client";

import { useState } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { CommandPaletteProvider } from "@/providers/CommandPaletteProvider";
import { RouteRecorder } from "@/components/RouteRecorder";
import { cn } from "@basicsos/ui";

const DashboardShell = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />

      {/* Right side: canvas controls + paper surface */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader />

        {/* Paper wrapper: padding creates gap between paper and window edges */}
        <div className="flex-1 overflow-hidden pr-3 pb-3">
          <div className="h-full overflow-auto rounded-2xl bg-paper text-paper-foreground shadow-paper">
            <div className={cn("mx-auto max-w-6xl p-8")}>{children}</div>
          </div>
        </div>
      </div>

      <RouteRecorder />
    </div>
  );
};

const DashboardLayout = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <CommandPaletteProvider>
    <DashboardShell>{children}</DashboardShell>
  </CommandPaletteProvider>
);

export default DashboardLayout;
