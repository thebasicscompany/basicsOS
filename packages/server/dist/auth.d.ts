import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
export declare function createAuth(db: Db, baseUrl: string, secret: string, allowedOrigins: string[], env: Env): import("better-auth").Auth<{
    database: (options: import("better-auth").BetterAuthOptions) => import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>;
    basePath: string;
    baseURL: string;
    secret: string;
    trustedOrigins: (req: Request | undefined) => Promise<string[]>;
    emailAndPassword: {
        enabled: true;
        sendResetPassword: ({ user, url }: {
            user: import("better-auth").User;
            url: string;
            token: string;
        }) => Promise<void>;
    };
    session: {
        cookieCache: {
            enabled: true;
        };
    };
}>;
//# sourceMappingURL=auth.d.ts.map