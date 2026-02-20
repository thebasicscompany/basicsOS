import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@basicsos/db";
import { tenants, invites } from "@basicsos/db";
import * as schema from "@basicsos/db";
import { and, eq, isNull, gt } from "drizzle-orm";

// Defer env var validation to first request — allows module evaluation during
// Next.js build-time static analysis without requiring env vars to be present.
const secret = process.env["BETTER_AUTH_SECRET"] ?? "";
const baseUrl =
  process.env["BETTER_AUTH_URL"] ?? process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

// API server URL — sessions created at baseURL must be readable from the API.
const apiUrl =
  process.env["NEXT_PUBLIC_API_URL"] ?? process.env["API_URL"] ?? "http://localhost:3001";

export const auth = betterAuth({
  secret,
  baseURL: baseUrl,
  trustedOrigins: [baseUrl, apiUrl],
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
        before: async (user) => {
          // If there's a valid pending invite for this email, join that tenant
          // instead of creating a new one. Mark the invite as accepted.
          const [invite] = await db
            .select()
            .from(invites)
            .where(
              and(
                eq(invites.email, user.email),
                isNull(invites.acceptedAt),
                gt(invites.expiresAt, new Date()),
              ),
            )
            .limit(1);

          if (invite) {
            await db
              .update(invites)
              .set({ acceptedAt: new Date() })
              .where(eq(invites.id, invite.id));
            return {
              data: {
                ...user,
                tenantId: invite.tenantId,
                role: invite.role,
              },
            };
          }

          // Fresh signup — create a new tenant, make the user admin.
          const [tenant] = await db
            .insert(tenants)
            .values({ name: user.name ?? "My Company" })
            .returning();
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
    updateAge: 60 * 60 * 24, // refresh if older than 1 day
  },
});

export type Auth = typeof auth;
