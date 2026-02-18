import { cors } from "hono/cors";

const allowedOrigins = process.env["ALLOWED_ORIGINS"]?.split(",") ?? [];

export const corsMiddleware = cors({
  origin: (origin) => {
    // Allow localhost in development
    if (process.env["NODE_ENV"] !== "production") return origin;
    // In production, only allow configured origins — never wildcard
    return allowedOrigins.includes(origin) ? origin : null;
  },
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
});
