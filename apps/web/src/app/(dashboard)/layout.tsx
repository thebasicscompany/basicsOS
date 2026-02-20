"use client";

import { AppShell } from "@basicsos/ui";
import { NavClient } from "./NavClient";
import { CommandPaletteProvider, useCommandPaletteContext } from "@/providers/CommandPaletteProvider";
import { RouteRecorder } from "@/components/RouteRecorder";

const DashboardShell = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const { setOpen } = useCommandPaletteContext();

  return (
    <AppShell variant="rail" sidebar={<NavClient onSearchClick={() => setOpen(true)} />}>
      <RouteRecorder />
      {children}
    </AppShell>
  );
};

// Next.js App Router requires default export for layouts.
// This is a framework-mandated exception to the project's named-export rule.
const DashboardLayout = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <CommandPaletteProvider>
    <DashboardShell>{children}</DashboardShell>
  </CommandPaletteProvider>
);

export default DashboardLayout;
