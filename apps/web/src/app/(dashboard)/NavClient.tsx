"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconRail, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@basicsos/ui";
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
} from "@basicsos/ui";

const NAV_ITEMS: IconRailItem[] = [
  { id: "knowledge", label: "Knowledge Base", href: "/knowledge", Icon: BookOpen, accentColor: "text-amber-600", accentBg: "bg-amber-50" },
  { id: "crm", label: "CRM", href: "/crm", Icon: Users, accentColor: "text-blue-600", accentBg: "bg-blue-50" },
  { id: "tasks", label: "Tasks", href: "/tasks", Icon: CheckSquare, accentColor: "text-emerald-600", accentBg: "bg-emerald-50" },
  { id: "meetings", label: "Meetings", href: "/meetings", Icon: Video, accentColor: "text-violet-600", accentBg: "bg-violet-50" },
  { id: "hub", label: "Hub", href: "/hub", Icon: Link2, accentColor: "text-rose-600", accentBg: "bg-rose-50" },
  { id: "assistant", label: "Assistant", href: "/assistant", Icon: Sparkles },
  { id: "admin", label: "Admin", href: "/admin/team", Icon: ShieldCheck },
  { id: "settings", label: "Settings", href: "/settings", Icon: Settings },
];

interface NavClientProps {
  onSearchClick?: () => void;
}

export const NavClient = ({ onSearchClick }: NavClientProps): JSX.Element => {
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
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-80">
        B
      </div>
    </Link>
  );

  return (
    <IconRail
      items={visibleItems}
      activeId={activeId}
      header={brandMark}
      onSearchClick={onSearchClick}
      userInitials={initials}
      onNavigate={(href) => router.push(href)}
      footer={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="mt-1 text-stone-500 hover:text-stone-700 transition-colors" aria-label="More options">
              <Settings size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" sideOffset={8}>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings size={14} className="mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleSignOut()}>
              <LogOut size={14} className="mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
};
