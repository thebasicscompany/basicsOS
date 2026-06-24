import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.preprocess(
    (val) => {
      const s = typeof val === "string" ? val.trim() : val;
      return s === "" || s == null ? undefined : s;
    },
    z.string().url().default("http://localhost:5173"),
  ),
  // When set, OAuth redirect goes to your app (e.g. https://app.example.com/connections?connected=slack). When unset, redirect goes to CONNECTIONS_SUCCESS_URL (default basicsos.com).
  FRONTEND_URL: z.preprocess(
    (val) => {
      const s = typeof val === "string" ? val.trim() : val;
      return s === "" || s == null ? undefined : s;
    },
    z.string().url().optional(),
  ),
  // URL users see after connecting Gmail/Slack when not using FRONTEND_URL. Default: basicsos.com/connections/success (no frontend hosting required).
  CONNECTIONS_SUCCESS_URL: z.preprocess(
    (val) => {
      const s = typeof val === "string" ? val.trim() : val;
      return s === "" || s == null ? undefined : s;
    },
    z.string().url().optional(),
  ),
  // Override for self-hosting / BYOK
  BASICSOS_API_URL: z.string().url().default("https://api.basicsos.com"),
  API_KEY_ENCRYPTION_KEY: z.string().optional(),
  API_KEY_ENCRYPTION_KEY_PREVIOUS: z.string().optional(),
  API_KEY_HASH_SECRET: z.string().optional(),
  // Static bearer hermes presents to the MCP Tool Broker (/mcp). Identifies THIS
  // company's hermes instance; per-user identity is carried per-call in _meta.
  BROKER_INSTANCE_TOKEN: z.string().optional(),
  // Dev/E2E: "1" loads the sample backend app module (APP-4c). Empty in prod.
  LOAD_SAMPLE_APP_MODULE: z.string().optional(),
  // Local hosted-app bundle dir (APP-4d, no Railway/GitHub). Hosted apps are
  // served framing-permissively from <dir>/{slug}/ at /hosted/{slug}/*. Default
  // ./hosted-apps. Maps cleanly to S3/static hosting later.
  HOSTED_APPS_DIR: z.string().optional(),
  // Public origin hosted bundles are served from (the entryUrl/origin in their
  // HostedSpec). Default http://localhost:3001 for local; an S3/CDN origin later.
  HOSTED_PUBLIC_ORIGIN: z.string().optional(),
  // The app bridge `agent.invoke` is DISABLED unless this is "1". It runs a hermes
  // turn with native tools (terminal/code) whose cwd holds the secrets .env, so an
  // app could exfiltrate the broker token. Keep off until app-originated turns run
  // a restricted broker-only toolset / sandbox (hermes hardening). Fail-closed.
  APP_AGENT_INVOKE_ENABLED: z.string().optional(),
  // This company's hermes sidecar (the agent brain behind in-app chat).
  HERMES_API_URL: z.string().url().default("http://localhost:8642"),
  HERMES_API_SERVER_KEY: z.string().optional(),
  // Host path of the artifacts dir bind-mounted into hermes (/opt/artifacts).
  // Files the agent generates land in <dir>/<threadId>/ and the app serves them.
  HERMES_ARTIFACTS_DIR: z.string().optional(),
  // Comma-separated origins for CORS (e.g. https://app.example.com,https://admin.example.com)
  // If set, used in addition to localhost. If empty, only localhost is allowed.
  ALLOWED_ORIGINS: z.string().optional().default(""),
  // Server-level AI key fallbacks (used when no org_ai_config row exists)
  SERVER_BASICS_API_KEY: z.string().optional(),
  SERVER_BYOK_PROVIDER: z.enum(["openai", "anthropic", "gemini"]).optional(),
  SERVER_BYOK_API_KEY: z.string().optional(),
  // Optional transcription BYOK (e.g. Deepgram) for voice STT when no org-level key
  SERVER_TRANSCRIPTION_BYOK_PROVIDER: z.enum(["deepgram"]).optional(),
  SERVER_TRANSCRIPTION_BYOK_API_KEY: z.string().optional(),
  // Path to built frontend static files (e.g. /app/dist). When set, server serves web app + API from same origin.
  STATIC_DIR: z.string().optional(),
  // Base URL for invite links. Default: https://basicsos.com — invitees sign up via the hosted auth flow.
  // Set to your app URL (e.g. https://app.example.com) to use in-app sign-up instead.
  INVITE_LINK_BASE_URL: z.preprocess(
    (val) => {
      const s = typeof val === "string" ? val.trim() : val;
      return s === "" || s == null ? undefined : s;
    },
    z.string().url().default("https://basicsos.com"),
  ),
  // Optional SMTP for password reset emails (when not using BasicsOS key). If both SMTP and SERVER_BASICS_API_KEY are set, SMTP takes precedence.
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().optional(),
  MAIL_USER: z.string().optional(),
  MAIL_PASS: z.string().optional(),
  MAIL_FROM: z.string().email().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return envSchema.parse(process.env);
}
