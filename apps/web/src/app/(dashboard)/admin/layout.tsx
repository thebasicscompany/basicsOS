"use client";

import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@basicsos/ui";

const ADMIN_TABS = [
  { href: "/admin/team", label: "Team" },
  { href: "/admin/modules", label: "Modules" },
  { href: "/admin/branding", label: "Branding" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/security", label: "Security" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/api-keys", label: "API Keys" },
  { href: "/admin/mcp", label: "MCP" },
  { href: "/admin/gateway", label: "Gateway" },
];

// Next.js App Router requires default exports for layout/page segments.
// This is a framework-mandated exception to the project's named-export rule.
const AdminLayout = ({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element => {
  const pathname = usePathname();

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-2xl font-semibold font-serif tracking-tight text-stone-900 dark:text-stone-100">Admin Panel</h2>
        <Tabs value={pathname} className="mt-3">
          <TabsList variant="underline" className="w-full overflow-x-auto">
            {ADMIN_TABS.map((tab) => (
              <TabsTrigger key={tab.href} value={tab.href} asChild>
                <a href={tab.href}>{tab.label}</a>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>
      <div>{children}</div>
    </div>
  );
};

export default AdminLayout;
