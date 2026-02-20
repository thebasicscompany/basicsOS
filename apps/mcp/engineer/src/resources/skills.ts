import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Lists and serves skill files from .claude/skills/
export const registerSkillsResource = (server: McpServer): void => {
  server.resource(
    "skills",
    "basicoseng://config/skills",
    { mimeType: "application/json" },
    async () => {
      const repoRoot = process.env["REPO_ROOT"] ?? process.cwd();
      const skillsDir = join(repoRoot, ".claude", "skills");
      let skills: Array<{ name: string; content: string }> = [];
      try {
        const dirs = await readdir(skillsDir);
        const reads = await Promise.all(
          dirs.map(async (dir) => {
            try {
              const content = await readFile(join(skillsDir, dir, "SKILL.md"), "utf-8");
              return { name: dir, content };
            } catch {
              return null;
            }
          }),
        );
        skills = reads.filter((s): s is { name: string; content: string } => s !== null);
      } catch {
        // Skills directory not found — return empty
      }
      return {
        contents: [
          {
            uri: "basicoseng://config/skills",
            mimeType: "application/json",
            text: JSON.stringify(skills, null, 2),
          },
        ],
      };
    },
  );
};
