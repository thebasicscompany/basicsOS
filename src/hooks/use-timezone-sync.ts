import { useEffect } from "react";
import { getRuntimeApiUrl } from "@/lib/runtime-config";

const API_URL = getRuntimeApiUrl();

/**
 * On app load, capture the browser's IANA timezone and persist it as the user's
 * timezone IF they haven't set one (force:false won't override an explicit choice).
 * This makes scheduled automations fire in the user's LOCAL time without any setup.
 */
export function useTimezoneSync() {
  useEffect(() => {
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;
    fetch(`${API_URL}/api/me/timezone`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz, force: false }),
    }).catch(() => {});
  }, []);
}
