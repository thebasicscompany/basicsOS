"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  SidebarPanel,
  Button,
  Separator,
  Avatar,
  AvatarFallback,
  Badge,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
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
  Zap,
  Search,
} from "@basicsos/ui";
import { useAuth } from "@/providers/AuthProvider";
import { authClient } from "@/lib/auth-client";
import { useCommandPaletteContext } from "@/providers/CommandPaletteProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@basicsos/ui";

const WORKSPACE_ITEMS: { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; badge?: string }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "/hub", label: "Hub", icon: Link2 },
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
  { href: "/admin/team", label: "Admin", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { setOpen: openSearch } = useCommandPaletteContext();

  const visibleItems = WORKSPACE_ITEMS.filter(
    (item) => (item.href.startsWith("/admin") ? user?.role === "admin" : true),
  );

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

  const header = (
    <div className="flex items-center gap-3">
      <Link href="/" className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary" aria-label="Home">
        <img src="/icon.svg" alt="" className="size-5 rounded text-sidebar-primary-foreground" />
      </Link>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold text-sidebar-foreground truncate">
          Basics OS
        </span>
        <span className="text-xs text-muted-foreground">Workspace</span>
      </div>
    </div>
  );

  const footer = (
    <>
      <Separator className="mb-3 bg-sidebar-border" />
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-sidebar-foreground truncate">
            {user?.name ?? "User"}
          </span>
          <span className="text-xs text-muted-foreground capitalize">
            {user?.role ?? "member"}
          </span>
        </div>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground"
                onClick={() => void handleSignOut()}
                aria-label="Sign out"
              >
                <LogOut size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Sign out</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );

  return (
    <SidebarPanel
      header={header}
      footer={footer}
      width="w-56"
      className="shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <Separator className="bg-sidebar-border" />

      <div className="px-2 py-3">
        <p className="px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        <nav className="flex flex-col gap-1">
          {visibleItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex w-full items-center gap-2 overflow-hidden rounded-md px-2 py-2 text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                )}
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge != null && (
                  <Badge
                    variant="secondary"
                    className="ml-auto text-[10px] h-5 px-1.5 py-0 border-0 bg-sidebar-primary/10 text-sidebar-primary"
                  >
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="px-2 py-3">
        <p className="px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </p>
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            className="justify-start gap-2 px-2 py-2 h-8 text-sm font-normal text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => openSearch(true)}
          >
            <Search size={16} className="shrink-0" />
            <span className="flex-1 text-left">Search</span>
            <span className="text-[10px] font-mono text-muted-foreground">/</span>
          </Button>
          <ThemeToggle />
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              pathname.startsWith("/settings") && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
            )}
          >
            <Settings size={16} className="shrink-0" />
            Settings
          </Link>
        </div>
      </div>
    </SidebarPanel>
  );
}
