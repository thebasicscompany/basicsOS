import { createAuthClient } from "better-auth/react";
import { getRuntimeApiUrl } from "@/lib/runtime-config";

const API_URL = getRuntimeApiUrl();

/**
 * Better Auth client — single instance shared across the app.
 * Session state is managed internally via cookies.
 */
export const authClient = createAuthClient({
  baseURL: API_URL || undefined,
});
