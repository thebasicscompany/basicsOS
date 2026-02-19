import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies before imports
vi.mock("./semantic-search.js", () => ({
  semanticSearch: vi.fn().mockResolvedValue([]),
}));
vi.mock("./llm-client.js", () => ({
  chatCompletion: vi.fn().mockResolvedValue({ content: "stub answer", finishReason: "stop" }),
}));

import { ragChat } from "./rag.js";
import { semanticSearch } from "./semantic-search.js";
import { chatCompletion } from "./llm-client.js";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ragChat", () => {
  it("returns an answer string", async () => {
    const result = await ragChat("What is the deal status?", TENANT_ID);
    expect(typeof result.answer).toBe("string");
    expect(result.answer).toBe("stub answer");
  });

  it("calls semanticSearch with the query and tenantId", async () => {
    await ragChat("test query", TENANT_ID);
    expect(semanticSearch).toHaveBeenCalledWith("test query", TENANT_ID, 20);
  });

  it("calls chatCompletion with assembled messages", async () => {
    await ragChat("hello", TENANT_ID);
    expect(chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user", content: "hello" }),
        ]),
      }),
      // Second argument is the telemetry context — we don't assert its shape here
      expect.anything(),
    );
  });

  it("includes conversation history in messages", async () => {
    const history = [
      { role: "user" as const, content: "previous question" },
      { role: "assistant" as const, content: "previous answer" },
    ];
    await ragChat("follow-up", TENANT_ID, history);
    const call = (chatCompletion as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
    const messages = (call[0] as { messages: Array<{ role: string }> } | undefined)?.messages ?? [];
    const roles = messages.map((m) => m.role);
    expect(roles).toContain("user");
    expect(roles).toContain("assistant");
  });

  it("returns graceful error when LLM fails", async () => {
    (chatCompletion as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("timeout"));
    const result = await ragChat("test", TENANT_ID);
    expect(result.answer).toContain("unavailable");
    expect(result.finishReason).toBe("error");
    expect(result.sources).toHaveLength(0);
  });

  it("returns empty sources when search fails", async () => {
    (semanticSearch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB down"));
    const result = await ragChat("test", TENANT_ID);
    expect(result.sources).toHaveLength(0);
    expect(result.answer).toBe("stub answer"); // LLM still called
  });
});
