export const RECENT_ROUTES_KEY = "basicos:recent-routes";
export const MAX_RECENT_ROUTES = 8;

export interface RecentRoute {
  path: string;
  moduleId: string;
  title: string;
  timestamp: number;
}

const MODULE_PREFIXES: ReadonlyArray<{ prefix: string; moduleId: string }> = [
  { prefix: "/knowledge", moduleId: "knowledge" },
  { prefix: "/crm", moduleId: "crm" },
  { prefix: "/tasks", moduleId: "tasks" },
  { prefix: "/meetings", moduleId: "meetings" },
  { prefix: "/hub", moduleId: "hub" },
  { prefix: "/assistant", moduleId: "assistant" },
  { prefix: "/admin", moduleId: "admin" },
  { prefix: "/settings", moduleId: "settings" },
];

export const moduleIdForPath = (path: string): string => {
  const match = MODULE_PREFIXES.find((p) => path.startsWith(p.prefix));
  return match?.moduleId ?? "settings";
};

export const readRecentRoutes = (): RecentRoute[] => {
  try {
    const raw = localStorage.getItem(RECENT_ROUTES_KEY);
    if (!raw) return [];
    const routes = JSON.parse(raw) as RecentRoute[];
    // Deduplicate by path — keep the most recent entry
    const seen = new Set<string>();
    return routes.filter((r) => {
      if (seen.has(r.path)) return false;
      seen.add(r.path);
      return true;
    });
  } catch {
    return [];
  }
};
