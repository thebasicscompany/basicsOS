import { describe, it, expect, vi, beforeAll } from "vitest";
import { createApp } from "./server.js";

// Mock Redis to prevent real connections in unit tests
vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  })),
}));

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  app = createApp();
});

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("ok");
  });

  it("includes a timestamp", async () => {
    const res = await app.request("/health");
    const body = await res.json() as { timestamp: string };
    expect(new Date(body.timestamp).getTime()).toBeGreaterThan(0);
  });
});

describe("POST /trpc/auth.me", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await app.request("/trpc/auth.me", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    // tRPC returns 401 for UNAUTHORIZED errors
    expect(res.status).toBe(401);
  });
});

describe("CORS", () => {
  it("allows requests in development mode", async () => {
    const res = await app.request("/health", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    });
    expect(res.status).toBeLessThan(500);
  });
});
