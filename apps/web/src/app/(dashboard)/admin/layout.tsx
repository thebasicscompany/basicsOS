"use client";

import { usePathname } from "next/navigation";
import { cn } from "@basicsos/ui";

const ADMIN_TABS = [
  { href: "/admin/team", label: "Team" },
  { href: "/admin/modules", label: "Modules" },
  { href: "/admin/branding", label: "Branding" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/security", label: "Security" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/api-keys", label: "API Keys" },
  { href: "/admin/mcp", label: "MCP" },
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
        <h2 className="text-2xl font-bold text-stone-900">Admin Panel</h2>
        <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-stone-200">
          {ADMIN_TABS.map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              className={cn(
                "whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors",
                pathname === tab.href
                  ? "border-b-2 border-primary text-primary"
                  : "text-stone-500 hover:text-stone-700",
              )}
            >
              {tab.label}
            </a>
          ))}
        </nav>
      </header>
      <div>{children}</div>
    </div>
  );
};

export default AdminLayout;
