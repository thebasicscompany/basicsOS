"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  MagnifyingGlass,
  Sun,
  Moon,
} from "@basicsos/ui";
import { useCommandPaletteContext } from "@/providers/CommandPaletteProvider";

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

export function DashboardHeader(): JSX.Element {
  const pathname = usePathname();
  const label = getBreadcrumbLabel(pathname);
  const { setOpen: openSearch } = useCommandPaletteContext();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <header className="flex h-12 shrink-0 items-center px-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm text-foreground">{label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => openSearch(true)}
                className="flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label="Search"
              >
                <MagnifyingGlass size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Search <span className="ml-1 font-mono text-[10px]">/</span>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Moon size={16} /> : <Sun size={16} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {isDark ? "Light mode" : "Dark mode"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}
