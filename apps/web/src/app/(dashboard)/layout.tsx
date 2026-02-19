import { NavClient } from "./NavClient";
import { LazyAssistantPanel } from "./LazyAssistantPanel";

// Next.js App Router requires default export for layouts.
// This is a framework-mandated exception to the project's named-export rule.
const DashboardLayout = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <div className="flex h-screen bg-background">
    <NavClient />
    <main className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-6xl">
        {children}
      </div>
    </main>
    <LazyAssistantPanel />
  </div>
);

export default DashboardLayout;
