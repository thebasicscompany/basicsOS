import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, users, sessions, accounts, verifications, tenants, invites } from "@basicsos/db";
import { and, eq, isNull, gt } from "drizzle-orm";
import { createLogger } from "@basicsos/shared";

const logger = createLogger("auth");

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
  trustedOrigins: [
    baseUrl,
    apiUrl,
    // Allow 127.0.0.1 variants for local dev tools (e.g. Claude Preview)
    baseUrl.replace("localhost", "127.0.0.1"),
    apiUrl.replace("localhost", "127.0.0.1"),
  ],
  advanced: {
    database: {
      // All ID columns are uuid type — tell Better Auth to generate UUIDs
      // instead of its default nanoid, which fails uuid column validation.
      generateId: () => crypto.randomUUID(),
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    // Better Auth looks up models by singular key name ("user", "session", …).
    // Our exports use plural names so we map them explicitly here.
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
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
          try {
            logger.debug({ email: user.email }, "User creation hook triggered");
            
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
              logger.debug({ email: user.email, tenantId: invite.tenantId }, "Found pending invite, joining tenant");
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
            logger.debug({ email: user.email }, "No invite found, creating new tenant");
            const [tenant] = await db
              .insert(tenants)
              .values({ name: user.name ?? "My Company" })
              .returning();
            
            if (!tenant) {
              logger.error({ email: user.email }, "Failed to create tenant");
              throw new Error("Failed to create tenant");
            }
            
            logger.debug({ email: user.email, tenantId: tenant.id }, "Created new tenant for user");
            return {
              data: {
                ...user,
                tenantId: tenant.id,
                role: "admin",
              },
            };
          } catch (error: unknown) {
            logger.error(
              {
                err: error,
                email: user.email,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined,
              },
              "Error in user creation hook",
            );
            throw error;
          }
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
