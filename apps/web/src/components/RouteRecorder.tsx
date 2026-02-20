"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { RECENT_ROUTES_KEY, MAX_RECENT_ROUTES, moduleIdForPath } from "@/lib/recent-routes";
import type { RecentRoute } from "@/lib/recent-routes";

const ALLOWED_PREFIXES = [
  "/knowledge",
  "/crm",
  "/tasks",
  "/meetings",
  "/hub",
  "/assistant",
  "/admin",
  "/settings",
];

const FALLBACK_LABELS: Record<string, string> = {
  "/knowledge": "Knowledge Base",
  "/crm": "CRM",
  "/tasks": "Tasks",
  "/meetings": "Meetings",
  "/hub": "Hub",
  "/assistant": "Assistant",
  "/settings": "Settings",
  "/admin/team": "Admin - Team",
  "/admin/modules": "Admin - Modules",
  "/admin/usage": "Admin - Usage",
  "/admin/security": "Admin - Security",
  "/admin/branding": "Admin - Branding",
  "/admin/mcp": "Admin - MCP",
};

const labelForPath = (path: string): string => {
  const exact = FALLBACK_LABELS[path];
  if (exact) return exact;
  const prefix = Object.keys(FALLBACK_LABELS).find((k) => path.startsWith(k));
  if (prefix) return FALLBACK_LABELS[prefix] ?? path;
  return path;
};

const resolveTitle = (path: string): string => {
  // Try the page's <h1> first — gives the most specific context
  const h1 = document.querySelector("h1");
  const h1Text = h1?.textContent?.trim() ?? "";
  if (h1Text.length > 0 && h1Text.length < 80) return h1Text;

  // Fall back to document.title with site name stripped
  const raw = document.title;
  const cleaned = raw.replace(/\s*[-|]\s*Basics?\s*OS.*$/i, "").trim();
  if (cleaned.length > 0 && !/^basics?\s*os$/i.test(cleaned)) return cleaned;

  return labelForPath(path);
};

/**
 * Records the current route to localStorage for recent work on the dashboard.
 * Rendered in the dashboard layout — no visible UI.
 */
export const RouteRecorder = (): null => {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === "/") return;

    const isAllowed = ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (!isAllowed) return;

    // Wait for page title to settle, then store enriched route
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(RECENT_ROUTES_KEY);
        const recent: RecentRoute[] = raw ? (JSON.parse(raw) as RecentRoute[]) : [];

        const entry: RecentRoute = {
          path: pathname,
          moduleId: moduleIdForPath(pathname),
          title: resolveTitle(pathname),
          timestamp: Date.now(),
        };

        const updated = [entry, ...recent.filter((r) => r.path !== pathname)].slice(
          0,
          MAX_RECENT_ROUTES,
        );
        localStorage.setItem(RECENT_ROUTES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
};
