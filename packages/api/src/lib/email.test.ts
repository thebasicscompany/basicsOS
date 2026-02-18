import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendInviteEmail, buildInviteHtml } from "./email.js";

const sampleOpts = {
  to: "user@example.com",
  inviterName: "Alice",
  companyName: "Acme Corp",
  role: "member",
  inviteUrl: "http://localhost:3000/auth/invite/test-token-123",
};

describe("sendInviteEmail (stub mode — no RESEND_API_KEY)", () => {
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env["RESEND_API_KEY"];
    delete process.env["RESEND_API_KEY"];
  });

  afterEach(() => {
    if (savedKey !== undefined) process.env["RESEND_API_KEY"] = savedKey;
    else delete process.env["RESEND_API_KEY"];
    vi.restoreAllMocks();
  });

  it("logs to console when RESEND_API_KEY is not set", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await sendInviteEmail(sampleOpts);
    expect(warnSpy).toHaveBeenCalled();
    const firstCall = warnSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(String(firstCall?.[0])).toContain("[email]");
  });

  it("does not throw when RESEND_API_KEY is missing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(sendInviteEmail(sampleOpts)).resolves.toBeUndefined();
  });

  it("logs the recipient email address", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await sendInviteEmail(sampleOpts);
    const allWarnings = warnSpy.mock.calls.map((c) => String(c[0])).join(" ");
    expect(allWarnings).toContain(sampleOpts.to);
  });

  it("logs the invite URL", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await sendInviteEmail(sampleOpts);
    const allWarnings = warnSpy.mock.calls.map((c) => String(c[0])).join(" ");
    expect(allWarnings).toContain(sampleOpts.inviteUrl);
  });
});

describe("buildInviteHtml", () => {
  it("contains the invite URL as a link", () => {
    const html = buildInviteHtml(sampleOpts);
    expect(html).toContain(sampleOpts.inviteUrl);
  });

  it("contains the inviter name", () => {
    const html = buildInviteHtml(sampleOpts);
    expect(html).toContain(sampleOpts.inviterName);
  });

  it("contains the company name", () => {
    const html = buildInviteHtml(sampleOpts);
    expect(html).toContain(sampleOpts.companyName);
  });

  it("contains the role", () => {
    const html = buildInviteHtml(sampleOpts);
    expect(html).toContain(sampleOpts.role);
  });

  it("is valid HTML with a body tag", () => {
    const html = buildInviteHtml(sampleOpts);
    expect(html).toContain("<body");
    expect(html).toContain("</body>");
  });
});
