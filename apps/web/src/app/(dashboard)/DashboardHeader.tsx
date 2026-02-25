"use client";

import { usePathname } from "next/navigation";
import {
  Button,
  Separator,
  PanelLeft,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@basicsos/ui";

const PATH_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/knowledge": "Knowledge Base",
  "/crm": "CRM",
  "/tasks": "Tasks",
  "/meetings": "Meetings",
  "/hub": "Hub",
  "/automations": "Automations",
  "/assistant": "Assistant",
  "/settings": "Settings",
  "/admin": "Admin",
};

function getBreadcrumbLabel(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  for (const [path, label] of Object.entries(PATH_LABELS)) {
    if (path !== "/" && pathname.startsWith(path)) return label;
  }
  const segment = pathname.split("/").filter(Boolean)[0];
  if (segment) return segment.charAt(0).toUpperCase() + segment.slice(1);
  return "Dashboard";
}

interface DashboardHeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function DashboardHeader({
  sidebarCollapsed,
  onToggleSidebar,
}: DashboardHeaderProps): JSX.Element {
  const pathname = usePathname();
  const label = getBreadcrumbLabel(pathname);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-4 pt-4">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-1 size-7 text-muted-foreground"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <PanelLeft size={18} className={sidebarCollapsed ? "rotate-180" : ""} />
      </Button>
      <Separator orientation="vertical" className="h-4 bg-border" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm text-foreground">{label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
