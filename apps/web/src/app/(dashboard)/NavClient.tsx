"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconRail, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@basicsos/ui";
import type { IconRailItem } from "@basicsos/ui";
import { useAuth } from "@/providers/AuthProvider";
import { authClient } from "@/lib/auth-client";
import {
  BookOpen,
  Users,
  CheckSquare,
  Video,
  Link2,
  Sparkles,
  ShieldCheck,
  Settings,
  LogOut,
  Zap,
} from "@basicsos/ui";

const NAV_ITEMS: IconRailItem[] = [
  { id: "knowledge", label: "Knowledge Base", href: "/knowledge", Icon: BookOpen, accentColor: "text-amber-600 dark:text-amber-400", accentBg: "bg-amber-50 dark:bg-amber-900/30" },
  { id: "crm", label: "CRM", href: "/crm", Icon: Users, accentColor: "text-blue-600 dark:text-blue-400", accentBg: "bg-blue-50 dark:bg-blue-900/30" },
  { id: "tasks", label: "Tasks", href: "/tasks", Icon: CheckSquare, accentColor: "text-emerald-600 dark:text-emerald-400", accentBg: "bg-emerald-50 dark:bg-emerald-900/30" },
  { id: "meetings", label: "Meetings", href: "/meetings", Icon: Video, accentColor: "text-violet-600 dark:text-violet-400", accentBg: "bg-violet-50 dark:bg-violet-900/30" },
  { id: "hub", label: "Hub", href: "/hub", Icon: Link2, accentColor: "text-rose-600 dark:text-rose-400", accentBg: "bg-rose-50 dark:bg-rose-900/30" },
  { id: "automations", label: "Automations", href: "/automations", Icon: Zap, accentColor: "text-orange-600 dark:text-orange-400", accentBg: "bg-orange-50 dark:bg-orange-900/30" },
  { id: "assistant", label: "Assistant", href: "/assistant", Icon: Sparkles },
  { id: "admin", label: "Admin", href: "/admin/team", Icon: ShieldCheck },
  { id: "settings", label: "Settings", href: "/settings", Icon: Settings },
];

export const NavClient = (): JSX.Element => {
  const pathname = usePathname();
  const { user } = useAuth();
  const router = useRouter();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.href.startsWith("/admin") ? user?.role === "admin" : true,
  );

  const activeId =
    visibleItems.find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
    )?.id;

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

  const brandMark = (
    <Link href="/" aria-label="Home">
      <img
        src="/icon.svg"
        alt="Logo"
        className="h-8 w-8 rounded-lg transition-opacity hover:opacity-80"
      />
    </Link>
  );

  return (
    <IconRail
      items={visibleItems}
      activeId={activeId}
      header={brandMark}
      userInitials={initials}
      onNavigate={(href) => router.push(href)}
      footer={
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => void handleSignOut()}
                className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 dark:text-stone-500 transition-colors hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Sign out</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
    />
  );
};
