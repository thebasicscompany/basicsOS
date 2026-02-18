import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chatCompletion } from "./llm-client.js";

describe("chatCompletion (stub mode — no API key)", () => {
  let savedBasicosKey: string | undefined;
  let savedAnthropicKey: string | undefined;

  beforeEach(() => {
    savedBasicosKey = process.env["AI_API_KEY"];
    savedAnthropicKey = process.env["ANTHROPIC_API_KEY"];
    delete process.env["AI_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];
  });

  afterEach(() => {
    if (savedBasicosKey !== undefined) process.env["AI_API_KEY"] = savedBasicosKey;
    else delete process.env["AI_API_KEY"];
    if (savedAnthropicKey !== undefined) process.env["ANTHROPIC_API_KEY"] = savedAnthropicKey;
    else delete process.env["ANTHROPIC_API_KEY"];
  });

  it("returns stub response when no API key is configured", async () => {
    const result = await chatCompletion({ messages: [{ role: "user", content: "hello" }] });
    expect(result.content).toContain("unavailable");
    expect(result.finishReason).toBe("stop");
  });

  it("returns a string content", async () => {
    const result = await chatCompletion({ messages: [{ role: "user", content: "test" }] });
    expect(typeof result.content).toBe("string");
  });
});
