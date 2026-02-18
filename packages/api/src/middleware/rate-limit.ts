import type { Context, Next } from "hono";
import { Redis } from "ioredis";

let redisClient: Redis | null = null;

const getRedis = (): Redis => {
  if (!redisClient) {
    const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";
    redisClient = new Redis(url, { lazyConnect: true, enableOfflineQueue: false });
  }
  return redisClient;
};

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 100;

export const rateLimitMiddleware = async (c: Context, next: Next): Promise<Response | void> => {
  const ip = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";
  const key = `ratelimit:${ip}`;

  try {
    const redis = getRedis();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }
    if (count > MAX_REQUESTS) {
      return c.json({ error: "Too many requests" }, 429);
    }
  } catch {
    // If Redis is unavailable, allow the request through (fail open for availability)
  }

  await next();
};
