import { createContext } from "react";
import type { AppConfig } from "@/types/apps";

export interface AppRegistryContextValue {
  /** Active apps for this company, ordered for the sidebar. */
  apps: AppConfig[];
  /** All apps the user may see (includes non-active for admins, for previewing). */
  allApps: AppConfig[];
  getApp: (slug: string) => AppConfig | undefined;
  isLoading: boolean;
  error: Error | null;
}

export const AppRegistryContext = createContext<AppRegistryContextValue>({
  apps: [],
  allApps: [],
  getApp: () => undefined,
  isLoading: true,
  error: null,
});
