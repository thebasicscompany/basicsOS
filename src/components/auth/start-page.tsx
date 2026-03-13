import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router";
import { authClient } from "@/lib/auth-client";
import { LoginPage } from "./login-page";

import { getRuntimeApiUrl } from "@/lib/runtime-config";
const API_URL = getRuntimeApiUrl();

/**
 * Entry point for the app. Handles three cases:
 *   1. Already logged in → /contacts
 *   2. Not initialized   → /sign-up (first-user setup)
 *   3. Initialized       → render LoginPage
 */
export function StartPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const { data: isInitialized, isPending: initPending } = useQuery({
    queryKey: ["init"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/init`, {
        credentials: "include",
      });
      const json = (await res.json()) as { initialized: boolean };
      return json.initialized;
    },
    retry: 1,
    // Only run after we know the session state
    enabled: !sessionPending && !session?.user,
  });

  // Still resolving session or init
  if (sessionPending || (!session?.user && initPending)) return null;

  // Already authenticated
  if (session?.user) return <Navigate to="/dashboard" replace />;

  // First-time setup
  if (!isInitialized) return <Navigate to="/sign-up" replace />;

  return <LoginPage />;
}
