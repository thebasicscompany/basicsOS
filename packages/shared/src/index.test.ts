import { describe, it, expect } from "vitest";
import { sharedVersion } from "./index.js";

describe("@basicsos/shared", () => {
  it("exports sharedVersion", () => {
    expect(sharedVersion).toBe("0.0.1");
  });
});
