"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  SidebarPanel,
  Button,
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
  ChevronDown,
  ChevronRight,
  Building2,
  Briefcase,
  BarChart3,
} from "@basicsos/ui";
import { useAuth } from "@/providers/AuthProvider";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { useCommandPaletteContext } from "@/providers/CommandPaletteProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@basicsos/ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = React.ComponentType<any>;

interface NavItem {
  href: string;
  label: string;
  icon: IconComponent;
  badge?: string;
  children?: Array<{ href: string; label: string; icon: IconComponent }>;
}

const CRM_SUBNAV = [
  { href: "/crm", label: "Dashboard", icon: BarChart3 },
  { href: "/crm/contacts", label: "People", icon: Users },
  { href: "/crm/companies", label: "Companies", icon: Building2 },
  { href: "/crm/deals", label: "Deals", icon: Briefcase },
];

const WORKSPACE_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
  { href: "/crm", label: "CRM", icon: Users, children: CRM_SUBNAV },
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
  const { user, isPending } = useAuth();
  const { data: me } = trpc.auth.me.useQuery();
  const { setOpen: openSearch } = useCommandPaletteContext();

  const isCrmActive = pathname.startsWith("/crm");
  const [crmExpanded, setCrmExpanded] = useState(isCrmActive);

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
          {me?.tenantName ?? "Basics OS"}
        </span>
        <span className="text-xs text-muted-foreground">Workspace</span>
      </div>
    </div>
  );

  const footer = (
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
          {isPending ? (
            <span className="mt-0.5 h-3 w-10 rounded bg-stone-200 dark:bg-stone-700 animate-pulse inline-block" />
          ) : (
            <span className="text-xs text-muted-foreground capitalize">
              {user?.role ?? "member"}
            </span>
          )}
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
  );

  return (
    <SidebarPanel
      header={header}
      footer={footer}
      width="w-60"
      className="shrink-0 text-sidebar-foreground"
    >
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

            if (item.children) {
              return (
                <CrmNavGroup
                  key={item.href}
                  item={item}
                  isActive={isActive}
                  expanded={crmExpanded}
                  onToggle={() => setCrmExpanded((v) => !v)}
                  pathname={pathname}
                />
              );
            }

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

function CrmNavGroup({
  item,
  isActive,
  expanded,
  onToggle,
  pathname,
}: {
  item: NavItem;
  isActive: boolean;
  expanded: boolean;
  onToggle: () => void;
  pathname: string;
}): JSX.Element {
  const Icon = item.icon;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "relative flex w-full items-center gap-2 overflow-hidden rounded-md px-2 py-2 text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        )}
      >
        <Icon size={16} className="shrink-0" />
        <span className="truncate flex-1 text-left">{item.label}</span>
        <Chevron size={14} className="shrink-0 text-muted-foreground" />
      </button>
      {expanded && item.children && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
          {item.children.map((child) => {
            const isChildActive =
              child.href === "/crm"
                ? pathname === "/crm"
                : pathname.startsWith(child.href);
            const ChildIcon = child.icon;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isChildActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                )}
              >
                <ChildIcon size={14} className="shrink-0" />
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
