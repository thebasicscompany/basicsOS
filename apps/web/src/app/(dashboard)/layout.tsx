import { House, Books, Handshake, CheckSquare, Target, Link, Gear } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

const NAV: { label: string; href: string; icon: Icon }[] = [
  { label: "Dashboard", href: "/", icon: House },
  { label: "Knowledge", href: "/knowledge", icon: Books },
  { label: "CRM", href: "/crm", icon: Handshake },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Meetings", href: "/meetings", icon: Target },
  { label: "Hub", href: "/hub", icon: Link },
  { label: "Admin", href: "/admin/team", icon: Gear },
];

// Next.js App Router requires default export for layouts.
const DashboardLayout = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <div className="flex h-screen bg-gray-50">
    {/* Sidebar */}
    <aside className="flex w-60 flex-col border-r bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">B</div>
        <div>
          <div className="font-semibold text-gray-900 text-sm">Basics OS</div>
          <div className="text-xs text-gray-500">Acme Corp</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAV.map(item => (
          <a key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 mb-1 transition">
            <item.icon size={20} className="flex-shrink-0" />
            <span className="font-medium">{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="border-t px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-700">A</div>
          <div className="text-xs">
            <div className="font-medium text-gray-900">Alex Chen</div>
            <div className="text-gray-500">Admin</div>
          </div>
        </div>
      </div>
    </aside>
    {/* Main content */}
    <main className="flex-1 overflow-y-auto p-8">
      {children}
    </main>
  </div>
);

export default DashboardLayout;
