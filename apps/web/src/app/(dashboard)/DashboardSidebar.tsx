"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Button,
  Avatar,
  AvatarFallback,
  Badge,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  SquaresFour,
  BookOpen,
  Users,
  CheckSquare,
  Video,
  Link as LinkIcon,
  Sparkle,
  ShieldCheck,
  Gear,
  SignOut,
  Lightning,
  CaretDown,
  CaretRight,
  SidebarIcon,
  Buildings,
  Briefcase,
  ChartBar,
} from "@basicsos/ui";
import { useAuth } from "@/providers/AuthProvider";
import { authClient } from "@/lib/auth-client";
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
  { href: "/crm", label: "Dashboard", icon: ChartBar },
  { href: "/crm/contacts", label: "People", icon: Users },
  { href: "/crm/companies", label: "Companies", icon: Buildings },
  { href: "/crm/deals", label: "Deals", icon: Briefcase },
];

const WORKSPACE_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: SquaresFour },
  { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
  { href: "/crm", label: "CRM", icon: Users, children: CRM_SUBNAV },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "/hub", label: "Hub", icon: LinkIcon },
  { href: "/automations", label: "Automations", icon: Lightning },
  { href: "/assistant", label: "Assistant", icon: Sparkle },
  { href: "/admin/team", label: "Admin", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Gear },
];

export function DashboardSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

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

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex h-full shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground",
          "transition-[width] duration-200 ease-in-out",
          collapsed ? "w-14" : "w-60",
        )}
      >
        {/* ── Header ── */}
        <div className="relative flex h-14 shrink-0 items-center border-b border-sidebar-border">
          {/* Collapsed state: expand button, centered */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity duration-150",
              collapsed ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggle}
                  className="flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  aria-label="Expand sidebar"
                >
                  <SidebarIcon size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Expand sidebar</TooltipContent>
            </Tooltip>
          </div>

          {/* Expanded state: logo + workspace name + collapse button */}
          <div
            className={cn(
              "flex w-full items-center gap-2.5 px-3 transition-opacity duration-150",
              collapsed ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <Link
              href="/"
              className="flex size-7 shrink-0 items-center justify-center"
              aria-label="Home"
            >
              <img src="/icon.svg" alt="" className="size-7 rounded-sm" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">Basics OS</p>
              <p className="text-[11px] leading-tight text-muted-foreground">Workspace</p>
            </div>
            <button
              onClick={onToggle}
              className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Collapse sidebar"
            >
              <SidebarIcon size={15} />
            </button>
          </div>
        </div>

        {/* ── Scrollable nav ── */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto py-3 scrollbar-thin">
          <nav className="flex flex-col gap-0.5 px-2">
            {visibleItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              // CRM group only when expanded
              if (!collapsed && item.children) {
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
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-sm px-2 text-sm outline-none transition-colors",
                        isActive
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        collapsed && "justify-center",
                      )}
                    >
                      <Icon size={15} className="shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && item.badge != null && (
                        <Badge
                          variant="secondary"
                          className="ml-auto h-5 border-0 bg-sidebar-primary/10 px-1.5 py-0 text-[10px] text-sidebar-primary"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-sidebar-border px-2 py-2.5">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="size-7 shrink-0 cursor-default">
                  <AvatarFallback className="bg-sidebar-primary/20 text-xs font-semibold text-sidebar-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" sideOffset={8}>{user?.name ?? "User"}</TooltipContent>
              )}
            </Tooltip>
            {/* Name + role: naturally clips when sidebar shrinks */}
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.name ?? "User"}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">{user?.role ?? "member"}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => void handleSignOut()}
              aria-label="Sign out"
            >
              <SignOut size={14} />
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
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
  const Chevron = expanded ? CaretDown : CaretRight;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-sm px-2 text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        )}
      >
        <Icon size={15} className="shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <Chevron size={13} className="shrink-0 text-muted-foreground" />
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
                  "flex h-7 items-center gap-2 rounded-sm px-2 text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isChildActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                )}
              >
                <ChildIcon size={13} className="shrink-0" />
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
