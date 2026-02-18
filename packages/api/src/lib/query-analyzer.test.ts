import { describe, it, expect } from "vitest";
import { analyzeQuery } from "./query-analyzer.js";

describe("analyzeQuery", () => {
  it("returns crm source when query contains 'deal'", () => {
    const result = analyzeQuery("What is the latest deal status?");
    expect(result.sources).toContain("crm");
  });

  it("returns only crm when query matches crm keywords exclusively", () => {
    const result = analyzeQuery("show me all contacts in the pipeline");
    expect(result.sources).toContain("crm");
    expect(result.sources).not.toContain("knowledge");
    expect(result.sources).not.toContain("meetings");
  });

  it("returns meetings source when query contains 'meeting'", () => {
    const result = analyzeQuery("What was discussed in the last meeting?");
    expect(result.sources).toContain("meetings");
  });

  it("returns only meetings when query matches meeting keywords exclusively", () => {
    const result = analyzeQuery("find transcript from last week");
    expect(result.sources).toContain("meetings");
    expect(result.sources).not.toContain("knowledge");
    expect(result.sources).not.toContain("crm");
  });

  it("returns knowledge source when query contains 'document'", () => {
    const result = analyzeQuery("Where is the document about onboarding?");
    expect(result.sources).toContain("knowledge");
  });

  it("returns only knowledge when query matches knowledge keywords exclusively", () => {
    const result = analyzeQuery("show me the wiki guide");
    expect(result.sources).toContain("knowledge");
    expect(result.sources).not.toContain("crm");
    expect(result.sources).not.toContain("meetings");
  });

  it("returns all 3 sources for a generic query", () => {
    const result = analyzeQuery("What is the status of things?");
    expect(result.sources).toHaveLength(3);
    expect(result.sources).toContain("knowledge");
    expect(result.sources).toContain("crm");
    expect(result.sources).toContain("meetings");
  });

  it("returns searchQuery equal to the original query", () => {
    const query = "How do I submit expenses?";
    const result = analyzeQuery(query);
    expect(result.searchQuery).toBe(query);
  });

  it("handles multiple matching categories in one query", () => {
    const result = analyzeQuery("What deal was decided in the meeting?");
    expect(result.sources).toContain("crm");
    expect(result.sources).toContain("meetings");
  });

  it("returns knowledge source when query contains 'policy'", () => {
    const result = analyzeQuery("What is the refund policy?");
    expect(result.sources).toContain("knowledge");
  });
});
