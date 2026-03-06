import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "crm:recent-pages";
const MAX_ITEMS = 8;

export interface RecentPage {
  /** Unique key for de-duplication, e.g. "/objects/contacts" or "/chat" */
  key: string;
  /** Display label, e.g. "Contacts" or "Chat" */
  label: string;
  /** Route path to navigate to */
  path: string;
  /** Icon slug for getObjectIcon, or a well-known key like "chat", "automations" */
  icon: string;
  /** Last visited timestamp */
  visitedAt: number;
}

function loadRecentPages(): RecentPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentPage =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as RecentPage).key === "string" &&
        typeof (x as RecentPage).label === "string" &&
        typeof (x as RecentPage).path === "string" &&
        typeof (x as RecentPage).visitedAt === "number",
    );
  } catch {
    return [];
  }
}

function saveRecentPages(items: RecentPage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function useRecentPages(): [RecentPage[], (page: RecentPage) => void] {
  const [pages, setPages] = useState<RecentPage[]>([]);

  useEffect(() => {
    setPages(loadRecentPages());
  }, []);

  const addRecentPage = useCallback((page: RecentPage) => {
    setPages((prev) => {
      const next = [
        { ...page, visitedAt: Date.now() },
        ...prev.filter((x) => x.key !== page.key),
      ].slice(0, MAX_ITEMS);
      saveRecentPages(next);
      return next;
    });
  }, []);

  return [pages, addRecentPage];
}
