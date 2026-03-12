import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import { createSendResetPassword } from "./lib/send-reset-password.js";

export function createAuth(
  db: Db,
  baseUrl: string,
  secret: string,
  allowedOrigins: string[],
  env: Env,
) {
  const allowedSet = new Set(
    allowedOrigins.map((o) => o.trim()).filter(Boolean),
  );
  const sendResetPasswordFn = createSendResetPassword(db, env);

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    basePath: "/api/auth",
    baseURL: baseUrl,
    secret,
    // Localhost (dev) + ALLOWED_ORIGINS (production) + null (Electron file://)
    trustedOrigins: async (req) => {
      const origin = req?.headers?.get("origin");
      if (!origin) return [];
      if (origin === "null") return ["null"];
      try {
        const url = new URL(origin);
        const isLocal =
          (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
          (url.protocol === "http:" || url.protocol === "https:");
        if (isLocal) return [origin];
        if (allowedSet.has(origin)) return [origin];
        return [];
      } catch {
        return [];
      }
    },
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        void sendResetPasswordFn(user.email, url, user.id);
      },
    },
    session: {
      cookieCache: { enabled: true },
    },
    // Cross-origin (Electron/localhost -> Railway): cookies must use SameSite=None
    ...(baseUrl.startsWith("https")
      ? {
          advanced: {
            defaultCookieAttributes: {
              sameSite: "none" as const,
              secure: true,
            },
          },
        }
      : {}),
  });
}
