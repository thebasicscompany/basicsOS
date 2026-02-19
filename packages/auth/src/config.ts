import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@basicsos/db";
import { tenants } from "@basicsos/db";
import * as schema from "@basicsos/db";

// Defer env var validation to first request — allows module evaluation during
// Next.js build-time static analysis without requiring env vars to be present.
const secret = process.env["BETTER_AUTH_SECRET"] ?? "";
const baseUrl =
  process.env["BETTER_AUTH_URL"] ?? process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

export const auth = betterAuth({
  secret,
  baseURL: baseUrl,
  advanced: {
    database: {
      // Our schema uses uuid columns — use UUID format for all generated IDs.
      generateId: "uuid",
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  user: {
    additionalFields: {
      tenantId: {
        type: "string",
        required: false, // Set via databaseHook before creation
        returned: true,
        input: false,
      },
      role: {
        type: "string",
        required: false,
        returned: true,
        input: false,
        defaultValue: "member",
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Create a new tenant for each signup (one company per account).
        before: async (user) => {
          const [tenant] = await db.insert(tenants).values({
            name: user.name ?? "My Company",
          }).returning();
          return {
            data: {
              ...user,
              tenantId: tenant!.id,
              role: "admin",
            },
          };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // refresh if older than 1 day
  },
});

export type Auth = typeof auth;
