import { createAuthClient } from "better-auth/client";

/**
 * Browser/client-side Better Auth client.
 * Used by web, desktop renderer, and mobile app.
 */
export const createClient = (baseURL: string) => createAuthClient({ baseURL });

export type AuthClient = ReturnType<typeof createClient>;
