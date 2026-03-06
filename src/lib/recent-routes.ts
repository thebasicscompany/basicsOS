const STORAGE_KEY = "basicos:recent-routes";
const MAX_ITEMS = 10;

export interface RecentRoute {
  path: string;
  title: string;
  objectType?: string;
  timestamp: number;
}

export function getRecentRoutes(): RecentRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentRoute[];
  } catch {
    return [];
  }
}

export function trackRecentRoute(route: Omit<RecentRoute, "timestamp">) {
  const routes = getRecentRoutes();
  const filtered = routes.filter((r) => r.path !== route.path);
  filtered.unshift({ ...route, timestamp: Date.now() });
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(filtered.slice(0, MAX_ITEMS)),
  );
}
