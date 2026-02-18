import { describe, it, expect } from "vitest";
import { assembleContext } from "./context-assembler.js";
import type { SearchResult } from "./semantic-search.js";

const makeResult = (
  sourceId: string,
  score: number,
  chunkText: string,
  sourceType: "document" | "meeting" = "document",
): SearchResult => ({ sourceId, score, chunkText, sourceType });

describe("assembleContext", () => {
  it("returns chunks sorted by score descending", () => {
    const results: SearchResult[] = [
      makeResult("doc-1", 0.5, "lower relevance text"),
      makeResult("doc-2", 0.9, "highest relevance text"),
      makeResult("doc-3", 0.7, "medium relevance text"),
    ];
    const { chunks } = assembleContext(results);
    expect(chunks[0]!.score).toBe(0.9);
    expect(chunks[1]!.score).toBe(0.7);
    expect(chunks[2]!.score).toBe(0.5);
  });

  it("returns empty chunks when given empty results", () => {
    const { chunks } = assembleContext([]);
    expect(chunks).toHaveLength(0);
  });

  it("tokensBudgeted is 0 for empty results", () => {
    const { tokensBudgeted } = assembleContext([]);
    expect(tokensBudgeted).toBe(0);
  });

  it("respects token budget and excludes chunks that exceed the limit", () => {
    // Each char costs 0.25 tokens; 400 chars = 100 tokens
    const bigText = "a".repeat(400);
    const results: SearchResult[] = [
      makeResult("doc-1", 0.9, bigText),
      makeResult("doc-2", 0.8, bigText),
      makeResult("doc-3", 0.7, bigText),
    ];
    // Budget of 150 tokens allows only 1 chunk (100 tokens each)
    const { chunks } = assembleContext(results, 150);
    expect(chunks).toHaveLength(1);
  });

  it("includes source metadata on each chunk", () => {
    const results: SearchResult[] = [
      makeResult("meeting-42", 0.85, "meeting content here", "meeting"),
    ];
    const { chunks } = assembleContext(results);
    expect(chunks[0]!.source).toBe("meeting");
    expect(chunks[0]!.sourceId).toBe("meeting-42");
    expect(chunks[0]!.text).toBe("meeting content here");
    expect(chunks[0]!.score).toBe(0.85);
  });

  it("includes all chunks within the token budget", () => {
    const results: SearchResult[] = [
      makeResult("doc-1", 0.9, "short"),
      makeResult("doc-2", 0.8, "also short"),
    ];
    const { chunks } = assembleContext(results, 8000);
    expect(chunks).toHaveLength(2);
  });

  it("does not mutate the original results array order", () => {
    const results: SearchResult[] = [
      makeResult("doc-a", 0.3, "low score"),
      makeResult("doc-b", 0.9, "high score"),
    ];
    const originalFirst = results[0]!.sourceId;
    assembleContext(results);
    expect(results[0]!.sourceId).toBe(originalFirst);
  });
});
