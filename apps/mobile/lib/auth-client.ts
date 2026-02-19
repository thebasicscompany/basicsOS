import { createAuthClient } from "better-auth/client";

const APP_URL = process.env["EXPO_PUBLIC_APP_URL"] ?? "http://localhost:3000";

// Auth client for mobile — points to the web app's Better Auth endpoints.
// Token-based auth (not cookies) since cookies aren't reliable in React Native.
export const authClient = createAuthClient({ baseURL: APP_URL });
