"use client";

import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@basicsos/ui";
import type { SidebarItem } from "@basicsos/ui";
import { useAuth } from "@/providers/AuthProvider";
import { authClient } from "@/lib/auth-client";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  CheckSquare,
  Video,
  Link2,
  Sparkles,
  ShieldCheck,
  Settings,
  LogOut,
} from "@basicsos/ui";

const NAV_ITEMS: SidebarItem[] = [
  { label: "Dashboard", href: "/", Icon: LayoutDashboard, section: "Workspace" },
  { label: "Knowledge", href: "/knowledge", Icon: BookOpen, section: "Workspace" },
  { label: "CRM", href: "/crm", Icon: Users, section: "Workspace" },
  { label: "Tasks", href: "/tasks", Icon: CheckSquare, section: "Workspace" },
  { label: "Meetings", href: "/meetings", Icon: Video, section: "Workspace" },
  { label: "Hub", href: "/hub", Icon: Link2, section: "Workspace" },
  { label: "Assistant", href: "/assistant", Icon: Sparkles, section: "Workspace" },
  { label: "Admin", href: "/admin/team", Icon: ShieldCheck, section: "System" },
  { label: "Settings", href: "/settings", Icon: Settings, section: "System" },
];

export const NavClient = (): JSX.Element => {
  const pathname = usePathname();
  const { user } = useAuth();
  const router = useRouter();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.href.startsWith("/admin") ? user?.role === "admin" : true,
  );

  const activeHref =
    visibleItems.find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
    )?.href ?? "/";

  const handleSignOut = async (): Promise<void> => {
    await authClient.signOut();
    router.push("/login");
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "A";

  return (
    <div className="flex h-full w-60 shrink-0 flex-col rounded-2xl border border-stone-200 bg-white">
      {/* Brand header */}
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          B
        </div>
        <div>
          <div className="text-sm font-semibold text-stone-900">Basics OS</div>
          <div className="text-xs text-stone-500">Company OS</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <Sidebar items={visibleItems} activeHref={activeHref} />
      </div>

      {/* User widget */}
      <div className="border-t border-stone-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </div>
            <div className="text-xs">
              <div className="font-medium text-stone-900">{user?.name ?? "Account"}</div>
              <div className="text-stone-500">{user?.email ?? ""}</div>
            </div>
          </div>
          <button
            onClick={() => void handleSignOut()}
            className="text-stone-400 hover:text-stone-600 transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
