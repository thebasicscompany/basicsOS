import { describe, expect, it } from "vitest";
import {
  parseSpecFromText,
  derivePermissions,
  parsePlan,
  extractHtmlFromText,
  hostedPermissions,
} from "@/lib/apps/builder.js";
import { staticDeclarativeChecks, validateHostedSpec } from "@/lib/apps/scan.js";

const goodSpec = {
  version: 1,
  pages: [
    {
      slug: "main",
      title: "Renewals",
      layout: "single",
      blocks: [
        { kind: "metric", dataSource: "renewing", field: "amount", agg: "sum" },
        { kind: "table", dataSource: "renewing", columns: ["name", "amount"] },
        { kind: "form", object: "tasks", onSubmit: "addTask" },
      ],
    },
  ],
  dataSources: [{ id: "renewing", tool: "object.deals.search", params: { status: "opportunity" } }],
  actions: [{ id: "addTask", tool: "object.tasks.create", confirm: true }],
};

describe("parseSpecFromText", () => {
  it("extracts a spec from a ```json fence", () => {
    const text = `Sure!\n\n\`\`\`json\n${JSON.stringify(goodSpec)}\n\`\`\`\nDone.`;
    expect(parseSpecFromText(text)).toMatchObject({ version: 1 });
  });
  it("extracts a spec from a bare ``` fence", () => {
    const text = `\`\`\`\n${JSON.stringify(goodSpec)}\n\`\`\``;
    expect(parseSpecFromText(text)).toMatchObject({ pages: expect.any(Array) });
  });
  it("extracts a spec from bare JSON with surrounding prose", () => {
    const text = `Here it is: ${JSON.stringify(goodSpec)} hope that helps`;
    expect(parseSpecFromText(text)).not.toBeNull();
  });
  it("returns null when there's no valid declarative spec", () => {
    expect(parseSpecFromText("no json here")).toBeNull();
    expect(parseSpecFromText('```json\n{"notPages": true}\n```')).toBeNull();
    expect(parseSpecFromText("")).toBeNull();
  });
});

describe("derivePermissions", () => {
  it("returns the unique tools the spec references", () => {
    expect(derivePermissions(goodSpec).sort()).toEqual([
      "object.deals.search",
      "object.tasks.create",
    ]);
  });
  it("returns [] for a spec with no data sources or actions", () => {
    expect(derivePermissions({ pages: [] })).toEqual([]);
  });
});

describe("parsePlan (builder phase 1)", () => {
  it("parses a plan with kind/name/tools (fenced or bare)", () => {
    const p = parsePlan('```json\n{"kind":"hosted","name":"Team Chat","summary":"chat","tools":["context.remember","context.recent"]}\n```');
    expect(p?.kind).toBe("hosted");
    expect(p?.name).toBe("Team Chat");
    expect(p?.tools).toEqual(["context.remember", "context.recent"]);
  });
  it("defaults kind to declarative and tolerates prose", () => {
    const p = parsePlan('Sure: {"name":"Dash","tools":["object.deals.search"]} ok');
    expect(p?.kind).toBe("declarative");
    expect(hostedPermissions(p!)).toEqual(["object.deals.search"]);
  });
  it("returns null on no JSON", () => {
    expect(parsePlan("no json here")).toBeNull();
  });
});

describe("extractHtmlFromText (hosted build)", () => {
  it("extracts a full HTML document from a ```html fence", () => {
    const html = extractHtmlFromText("Here:\n```html\n<!doctype html><html><body>hi</body></html>\n```\ndone");
    expect(html).toBe("<!doctype html><html><body>hi</body></html>");
  });
  it("extracts bare <html>… without a fence", () => {
    const html = extractHtmlFromText("<html><head></head><body>x</body></html>");
    expect(html).toContain("<body>x</body>");
  });
  it("returns null when there is no html document", () => {
    expect(extractHtmlFromText("just text")).toBeNull();
    expect(extractHtmlFromText("```json\n{}\n```")).toBeNull();
  });
});

describe("staticDeclarativeChecks", () => {
  it("passes a valid spec with granted tools (no critical, no warnings)", () => {
    const r = staticDeclarativeChecks(goodSpec, [
      "object.deals.search",
      "object.tasks.create",
    ]);
    expect(r.critical).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
  it("flags a non-declarative shape as critical", () => {
    expect(staticDeclarativeChecks({ entryUrl: "https://x" }, []).critical.length).toBeGreaterThan(0);
  });
  it("flags unsafe markdown as critical", () => {
    const bad = {
      pages: [{ blocks: [{ kind: "markdown", text: "<script>alert(1)</script>" }] }],
    };
    expect(staticDeclarativeChecks(bad, []).critical.length).toBeGreaterThan(0);
  });
  it("warns when the spec references an ungranted tool", () => {
    const r = staticDeclarativeChecks(goodSpec, ["object.deals.search"]);
    expect(r.critical).toEqual([]);
    expect(r.warnings.some((w) => w.includes("object.tasks.create"))).toBe(true);
  });
  it("warns on a wildcard grant", () => {
    expect(staticDeclarativeChecks(goodSpec, ["*"]).warnings.some((w) => w.includes("*"))).toBe(true);
  });
});

describe("validateHostedSpec", () => {
  it("accepts an https entryUrl whose origin matches", () => {
    expect(
      validateHostedSpec({ entryUrl: "https://app.acme.com/index.html", origin: "https://app.acme.com" }).ok,
    ).toBe(true);
  });
  it("accepts http://localhost for dev", () => {
    expect(validateHostedSpec({ entryUrl: "http://localhost:4000/", origin: "http://localhost:4000" }).ok).toBe(true);
  });
  it("rejects non-https remote, relative, data:, and javascript: URLs", () => {
    expect(validateHostedSpec({ entryUrl: "http://evil.com", origin: "http://evil.com" }).ok).toBe(false);
    expect(validateHostedSpec({ entryUrl: "/index.html", origin: "https://app.acme.com" }).ok).toBe(false);
    expect(validateHostedSpec({ entryUrl: "data:text/html,<h1>x", origin: "null" }).ok).toBe(false);
    expect(validateHostedSpec({ entryUrl: "javascript:alert(1)", origin: "x" }).ok).toBe(false);
  });
  it("rejects an origin that doesn't match the entryUrl origin", () => {
    expect(
      validateHostedSpec({ entryUrl: "https://app.acme.com/x", origin: "https://evil.com" }).ok,
    ).toBe(false);
  });
  it("rejects a missing entryUrl/origin", () => {
    expect(validateHostedSpec({ origin: "https://app.acme.com" }).ok).toBe(false);
    expect(validateHostedSpec({ entryUrl: "https://app.acme.com" }).ok).toBe(false);
    expect(validateHostedSpec(null).ok).toBe(false);
  });
});
