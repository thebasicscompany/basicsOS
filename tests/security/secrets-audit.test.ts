import { describe, it, expect } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SECRET_PATTERNS = [
  /ANTHROPIC_API_KEY\s*=\s*sk-ant-/,
  /OPENAI_API_KEY\s*=\s*sk-/,
  /BETTER_AUTH_SECRET\s*=\s*[a-zA-Z0-9]{20,}/, // hardcoded non-placeholder
  /DEEPGRAM_API_KEY\s*=\s*[a-zA-Z0-9]{20,}/,
];

// Exclude patterns (test stubs, examples, etc.)
const EXCLUDE_DIRS = ["node_modules", ".next", "dist", ".git"];
const EXCLUDE_FILES = [".env", ".env.example", "secrets-audit.test.ts"];

const getAllTsFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (EXCLUDE_DIRS.includes(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getAllTsFiles(fullPath)));
    } else if (entry.name.endsWith(".ts") && !EXCLUDE_FILES.includes(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
};

describe("Secrets Audit", () => {
  it("no hardcoded API keys or secrets in TypeScript source files", async () => {
    const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
    const files = await getAllTsFiles(join(repoRoot, "packages"));
    const violations: string[] = [];

    for (const file of files) {
      const content = await readFile(file, "utf-8");
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${file}: matches ${pattern}`);
        }
      }
    }

    expect(violations, `Found hardcoded secrets:\n${violations.join("\n")}`).toHaveLength(0);
  });
});
