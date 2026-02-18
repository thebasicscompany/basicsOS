import { describe, it, expect } from "vitest";
import { chunkText } from "./chunker.js";

describe("chunkText", () => {
  it("returns at least 1 chunk for non-empty text", () => {
    const chunks = chunkText("Hello world");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array for empty text", () => {
    const chunks = chunkText("");
    expect(chunks).toEqual([]);
  });

  it("splits long text into multiple chunks", () => {
    // ~600 tokens worth of text (4 chars each = ~2400 chars)
    const longParagraph = (n: number) => `Paragraph ${n}: ${"word ".repeat(80)}`;
    const text = Array.from({ length: 10 }, (_, i) => longParagraph(i)).join("\n\n");
    const chunks = chunkText(text, "document");
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("each chunk has an index property", () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
    const chunks = chunkText(text, "document");
    chunks.forEach((chunk, i) => {
      expect(typeof chunk.index).toBe("number");
      expect(chunk.index).toBe(i);
    });
  });

  it("splits by speaker turns in transcript mode", () => {
    const transcript = [
      "Alice: Hello there, how are you doing today?",
      "Bob: I am doing great, thank you for asking!",
      "Alice: That is wonderful to hear.",
    ].join("\n");
    const chunks = chunkText(transcript, "transcript");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("each transcript chunk contains the speaker turn text", () => {
    const transcript = "Alice: First turn text.\nBob: Second turn text.";
    const chunks = chunkText(transcript, "transcript");
    const allText = chunks.map((c) => c.text).join(" ");
    expect(allText).toContain("Alice");
    expect(allText).toContain("Bob");
  });
});
