"use client";

import { useState } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { NavClient } from "./NavClient";
import { CommandPaletteProvider } from "@/providers/CommandPaletteProvider";
import { RouteRecorder } from "@/components/RouteRecorder";
import { cn } from "@basicsos/ui";

const DashboardShell = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarCollapsed ? (
        <div className="flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
          <NavClient />
        </div>
      ) : (
        <DashboardSidebar />
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        />
        <div className="flex-1 overflow-auto bg-background p-6">
          <div className={cn("mx-auto max-w-6xl text-foreground")}>{children}</div>
        </div>
      </main>

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
