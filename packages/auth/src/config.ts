import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@basicsos/db";
import * as schema from "@basicsos/db";

const secret = process.env["BETTER_AUTH_SECRET"];
const baseUrl = process.env["BETTER_AUTH_URL"] ?? process.env["NEXT_PUBLIC_APP_URL"];

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required");
}
if (!baseUrl) {
  throw new Error("BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL environment variable is required");
}

export const auth = betterAuth({
  secret,
  baseURL: baseUrl,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
    },
  }),
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
