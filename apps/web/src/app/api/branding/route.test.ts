import { describe, it, expect } from "vitest";
import { GET } from "./route.js";

describe("GET /api/branding", () => {
  it("returns default branding when no env vars set", async () => {
    const res = GET({} as Parameters<typeof GET>[0]);
    const data = await res.json();
    expect(data.companyName).toBe("Basics OS");
    expect(data.accentColor).toBe("#6366f1");
    expect(typeof data.apiUrl).toBe("string");
  });
});
