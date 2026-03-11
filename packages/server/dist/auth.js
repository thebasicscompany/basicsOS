import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createSendResetPassword } from "./lib/send-reset-password.js";
export function createAuth(db, baseUrl, secret, allowedOrigins, env) {
    const allowedSet = new Set(allowedOrigins.map((o) => o.trim()).filter(Boolean));
    const sendResetPasswordFn = createSendResetPassword(db, env);
    return betterAuth({
        database: drizzleAdapter(db, { provider: "pg" }),
        basePath: "/api/auth",
        baseURL: baseUrl,
        secret,
        // Localhost (dev) + ALLOWED_ORIGINS (production)
        trustedOrigins: async (req) => {
            const origin = req?.headers?.get("origin");
            if (!origin)
                return [];
            try {
                const url = new URL(origin);
                const isLocal = (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
                    (url.protocol === "http:" || url.protocol === "https:");
                if (isLocal)
                    return [origin];
                if (allowedSet.has(origin))
                    return [origin];
                return [];
            }
            catch {
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
    });
}
