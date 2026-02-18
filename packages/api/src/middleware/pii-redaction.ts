// Simple regex-based PII detector and redactor
// Gates on ENABLE_PII_REDACTION=true env var

const PII_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  { name: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[EMAIL]" },
  { name: "phone_us", pattern: /\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE]" },
  { name: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" },
  { name: "credit_card", pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: "[CREDIT_CARD]" },
  { name: "ip_address", pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: "[IP_ADDRESS]" },
];

export type RedactionResult = {
  redacted: string;
  piiFound: string[];
};

export const redactPII = (text: string): RedactionResult => {
  if (process.env["ENABLE_PII_REDACTION"] !== "true") {
    return { redacted: text, piiFound: [] };
  }

  let result = text;
  const piiFound: string[] = [];

  for (const { name, pattern, replacement } of PII_PATTERNS) {
    const matches = result.match(pattern);
    if (matches && matches.length > 0) {
      piiFound.push(`${name}(${matches.length})`);
      result = result.replace(pattern, replacement);
    }
  }

  if (piiFound.length > 0) {
    console.warn(`[pii-redaction] Redacted PII types: ${piiFound.join(", ")}`);
  }

  return { redacted: result, piiFound };
};

// Apply redaction to a list of chat messages
export const redactMessagesForLLM = (
  messages: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> => {
  if (process.env["ENABLE_PII_REDACTION"] !== "true") return messages;
  return messages.map((m) => ({
    ...m,
    content: redactPII(m.content).redacted,
  }));
};
