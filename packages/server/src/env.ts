import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:5173"),
  // Override for self-hosting / BYOK
  BASICSOS_API_URL: z.string().url().default("https://api.basicsos.com"),
  API_KEY_ENCRYPTION_KEY: z.string().optional(),
  API_KEY_ENCRYPTION_KEY_PREVIOUS: z.string().optional(),
  API_KEY_HASH_SECRET: z.string().optional(),
  // Comma-separated origins for CORS (e.g. https://app.example.com,https://admin.example.com)
  // If set, used in addition to localhost. If empty, only localhost is allowed.
  ALLOWED_ORIGINS: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return envSchema.parse(process.env);
}
