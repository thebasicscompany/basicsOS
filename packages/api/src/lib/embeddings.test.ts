import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { embedTexts } from "./embeddings.js";

const EMBEDDING_DIMENSIONS = 1536;

describe("embedTexts", () => {
  let originalApiKey: string | undefined;
  let originalOpenAiKey: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env["AI_API_KEY"];
    originalOpenAiKey = process.env["OPENAI_API_KEY"];
    delete process.env["AI_API_KEY"];
    delete process.env["OPENAI_API_KEY"];
  });

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env["AI_API_KEY"] = originalApiKey;
    } else {
      delete process.env["AI_API_KEY"];
    }
    if (originalOpenAiKey !== undefined) {
      process.env["OPENAI_API_KEY"] = originalOpenAiKey;
    } else {
      delete process.env["OPENAI_API_KEY"];
    }
  });

  it("returns stub embeddings when no API key is set", async () => {
    const results = await embedTexts(["hello world"]);
    expect(results).toHaveLength(1);
  });

  it("each result has an embedding array of length 1536", async () => {
    const results = await embedTexts(["test text", "another text"]);
    for (const result of results) {
      expect(result.embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    }
  });

  it("each result includes the original text", async () => {
    const texts = ["first input", "second input"];
    const results = await embedTexts(texts);
    const resultTexts = results.map((r) => r.text);
    expect(resultTexts).toContain("first input");
    expect(resultTexts).toContain("second input");
  });

  it("returns one result per input text", async () => {
    const texts = ["a", "b", "c"];
    const results = await embedTexts(texts);
    expect(results).toHaveLength(texts.length);
  });

  it("embedding values are numbers", async () => {
    const [result] = await embedTexts(["numeric check"]);
    expect(result).toBeDefined();
    for (const val of result!.embedding) {
      expect(typeof val).toBe("number");
    }
  });
});
