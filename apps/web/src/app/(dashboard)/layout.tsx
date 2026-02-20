import { AppShell } from "@basicsos/ui";
import { NavClient } from "./NavClient";
import { LazyAssistantPanel } from "./LazyAssistantPanel";

// Next.js App Router requires default export for layouts.
// This is a framework-mandated exception to the project's named-export rule.
const DashboardLayout = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <AppShell sidebar={<NavClient />} floating={<LazyAssistantPanel />}>
    {children}
  </AppShell>
);

export default DashboardLayout;
