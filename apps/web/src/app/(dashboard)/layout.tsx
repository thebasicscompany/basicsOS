"use client";

import { useState } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { NavClient } from "./NavClient";
import { CommandPaletteProvider } from "@/providers/CommandPaletteProvider";
import { RouteRecorder } from "@/components/RouteRecorder";
import { BrandingStyle } from "@/components/BrandingStyle";
import { cn } from "@basicsos/ui";

const DashboardShell = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar: transparent on canvas — no border, no separate bg */}
      {sidebarCollapsed ? (
        <div className="flex h-full shrink-0 flex-col">
          <NavClient />
        </div>
      ) : (
        <DashboardSidebar onCollapse={() => setSidebarCollapsed(true)} />
      )}

      {/* Right side: canvas controls + paper surface */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        />

        {/* Paper wrapper: padding creates gap between paper and window edges */}
        <div className="flex-1 overflow-hidden pr-3 pb-3">
          <div className="h-full overflow-auto rounded-2xl bg-paper text-paper-foreground shadow-paper">
            <div className={cn("mx-auto max-w-6xl p-8")}>{children}</div>
          </div>
        </div>
      </div>

      <RouteRecorder />
      <BrandingStyle />
    </div>
  );
};

const DashboardLayout = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <CommandPaletteProvider>
    <DashboardShell>{children}</DashboardShell>
  </CommandPaletteProvider>
);

export default DashboardLayout;
