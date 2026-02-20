import { createAuthClient } from "better-auth/react";

// Better Auth client — used by client components and auth pages.
// Points to the web app itself since auth handlers are at /api/auth/*.
export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000"),
});
