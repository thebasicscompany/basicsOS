/**
 * Fetch-based web scraping utilities.
 * No Playwright dependency — uses native fetch + simple HTML parsing.
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/* ------------------------------------------------------------------ */
/*  HTML helpers                                                      */
/* ------------------------------------------------------------------ */

/** Strip all HTML tags, decode common entities, collapse whitespace. */
function htmlToText(html: string): string {
  let text = html
    // Remove script/style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Replace block-level tags with newlines
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote|section|article|header|footer|nav|main)[\s>]/gi, "\n")
    // Strip remaining tags
    .replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Collapse whitespace
  text = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return text.trim();
}

/** Very simple CSS-selector → regex matcher (id, class, tag only). */
function selectElements(html: string, selector: string): string[] {
  let pattern: RegExp;

  if (selector.startsWith("#")) {
    // ID selector
    const id = selector.slice(1);
    pattern = new RegExp(
      `<[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/`,
      "gi",
    );
  } else if (selector.startsWith(".")) {
    // Class selector
    const cls = selector.slice(1);
    pattern = new RegExp(
      `<[^>]+class=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/`,
      "gi",
    );
  } else {
    // Tag selector
    pattern = new RegExp(
      `<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`,
      "gi",
    );
  }

  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    if (m[1]) matches.push(m[1]);
  }
  return matches;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Fetch a URL and return its text content.
 * Optionally narrow by a CSS selector (id, class, or tag only).
 */
export async function extractText(
  url: string,
  selector?: string,
  maxLength = 12_000,
): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  const html = await res.text();
  let content: string;

  if (selector) {
    const elements = selectElements(html, selector);
    content = elements.map(htmlToText).join("\n\n");
    if (!content) {
      content = htmlToText(html);
    }
  } else {
    content = htmlToText(html);
  }

  if (content.length > maxLength) {
    content = content.slice(0, maxLength) + "\n[...truncated]";
  }

  return content;
}

/**
 * Fetch a URL and extract structured data by providing field names.
 * Returns key-value pairs parsed from the page text.
 */
export async function extractStructured(
  url: string,
  fields: string[],
  selector?: string,
): Promise<Record<string, string>> {
  const text = await extractText(url, selector, 20_000);
  const result: Record<string, string> = {};

  for (const field of fields) {
    // Try to find "Field: value" or "Field - value" patterns
    const pattern = new RegExp(
      `(?:^|\\n)\\s*${field}\\s*[:\\-–]\\s*(.+?)(?:\\n|$)`,
      "im",
    );
    const match = pattern.exec(text);
    if (match?.[1]) {
      result[field] = match[1].trim();
    }
  }

  // Always include a snippet of the raw text for the LLM to parse
  result["_raw_text"] = text.slice(0, 4_000);

  return result;
}
