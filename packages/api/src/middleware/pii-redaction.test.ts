import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { redactPII, redactMessagesForLLM } from "./pii-redaction.js";

describe("redactPII", () => {
  let savedFlag: string | undefined;

  beforeEach(() => {
    savedFlag = process.env["ENABLE_PII_REDACTION"];
    process.env["ENABLE_PII_REDACTION"] = "true";
  });

  afterEach(() => {
    if (savedFlag !== undefined) {
      process.env["ENABLE_PII_REDACTION"] = savedFlag;
    } else {
      delete process.env["ENABLE_PII_REDACTION"];
    }
  });

  it("is a no-op when ENABLE_PII_REDACTION is not set", () => {
    delete process.env["ENABLE_PII_REDACTION"];
    const input = "Contact me at user@example.com or 555-867-5309";
    const result = redactPII(input);
    expect(result.redacted).toBe(input);
    expect(result.piiFound).toHaveLength(0);
  });

  it("is a no-op when ENABLE_PII_REDACTION is set to a value other than 'true'", () => {
    process.env["ENABLE_PII_REDACTION"] = "false";
    const input = "Contact me at user@example.com";
    const result = redactPII(input);
    expect(result.redacted).toBe(input);
    expect(result.piiFound).toHaveLength(0);
  });

  it("replaces email addresses with [EMAIL]", () => {
    const result = redactPII("Email me at john.doe@example.com for details.");
    expect(result.redacted).toBe("Email me at [EMAIL] for details.");
  });

  it("replaces multiple email addresses in one pass", () => {
    const result = redactPII("From: a@b.com To: c@d.org");
    expect(result.redacted).toBe("From: [EMAIL] To: [EMAIL]");
  });

  it("replaces US phone numbers with [PHONE]", () => {
    const result = redactPII("Call me at 555-867-5309.");
    expect(result.redacted).toBe("Call me at [PHONE].");
  });

  it("replaces US phone numbers in dash-separated format", () => {
    const result = redactPII("My number is 800-555-1234.");
    expect(result.redacted).toBe("My number is [PHONE].");
  });

  it("replaces SSNs with [SSN]", () => {
    const result = redactPII("SSN: 123-45-6789");
    expect(result.redacted).toBe("SSN: [SSN]");
  });

  it("replaces credit card numbers with [CREDIT_CARD]", () => {
    const result = redactPII("Card: 4111 1111 1111 1111");
    expect(result.redacted).toBe("Card: [CREDIT_CARD]");
  });

  it("replaces credit card numbers with dash separators", () => {
    const result = redactPII("Card: 4111-1111-1111-1111");
    expect(result.redacted).toBe("Card: [CREDIT_CARD]");
  });

  it("replaces IP addresses with [IP_ADDRESS]", () => {
    const result = redactPII("Server at 192.168.1.100");
    expect(result.redacted).toBe("Server at [IP_ADDRESS]");
  });

  it("returns list of piiFound types with counts", () => {
    const result = redactPII("Email: a@b.com and c@d.com, SSN: 123-45-6789");
    expect(result.piiFound).toContain("email(2)");
    expect(result.piiFound).toContain("ssn(1)");
  });

  it("returns empty piiFound when no PII is detected", () => {
    const result = redactPII("Hello, this is a clean message.");
    expect(result.piiFound).toHaveLength(0);
  });

  it("handles text with no PII and returns it unchanged", () => {
    const input = "No sensitive data here.";
    const result = redactPII(input);
    expect(result.redacted).toBe(input);
  });

  it("handles empty string", () => {
    const result = redactPII("");
    expect(result.redacted).toBe("");
    expect(result.piiFound).toHaveLength(0);
  });

  it("redacts multiple PII types in a single message", () => {
    const result = redactPII("Contact: bob@example.com, 555-123-4567, SSN 987-65-4321");
    expect(result.redacted).toContain("[EMAIL]");
    expect(result.redacted).toContain("[PHONE]");
    expect(result.redacted).toContain("[SSN]");
    expect(result.piiFound).toHaveLength(3);
  });
});

describe("redactMessagesForLLM", () => {
  let savedFlag: string | undefined;

  beforeEach(() => {
    savedFlag = process.env["ENABLE_PII_REDACTION"];
    process.env["ENABLE_PII_REDACTION"] = "true";
  });

  afterEach(() => {
    if (savedFlag !== undefined) {
      process.env["ENABLE_PII_REDACTION"] = savedFlag;
    } else {
      delete process.env["ENABLE_PII_REDACTION"];
    }
  });

  it("returns original messages unchanged when ENABLE_PII_REDACTION is not set", () => {
    delete process.env["ENABLE_PII_REDACTION"];
    const messages = [{ role: "user", content: "My email is user@example.com" }];
    const result = redactMessagesForLLM(messages);
    expect(result).toBe(messages);
  });

  it("processes all messages in the array", () => {
    const messages = [
      { role: "user", content: "My email is user@example.com" },
      { role: "assistant", content: "Got it" },
      { role: "user", content: "SSN is 123-45-6789" },
    ];
    const result = redactMessagesForLLM(messages);
    expect(result[0]?.content).toBe("My email is [EMAIL]");
    expect(result[1]?.content).toBe("Got it");
    expect(result[2]?.content).toBe("SSN is [SSN]");
  });

  it("preserves the role field on each message", () => {
    const messages = [
      { role: "system", content: "System prompt with user@host.com" },
      { role: "user", content: "User message" },
    ];
    const result = redactMessagesForLLM(messages);
    expect(result[0]?.role).toBe("system");
    expect(result[1]?.role).toBe("user");
  });

  it("returns a new array (does not mutate original)", () => {
    const messages = [{ role: "user", content: "email: a@b.com" }];
    const result = redactMessagesForLLM(messages);
    expect(result).not.toBe(messages);
    expect(messages[0]?.content).toBe("email: a@b.com");
  });

  it("handles an empty messages array", () => {
    const result = redactMessagesForLLM([]);
    expect(result).toEqual([]);
  });
});
