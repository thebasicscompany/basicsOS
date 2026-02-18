import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Serves CLAUDE.md content as a resource so AI tools can read it
export const registerClaudeMdResource = (server: McpServer): void => {
  server.resource(
    "claude-md",
    "basicoseng://config/CLAUDE.md",
    { mimeType: "text/markdown" },
    async () => {
      const repoRoot = process.env["REPO_ROOT"] ?? process.cwd();
      let content: string;
      try {
        content = await readFile(join(repoRoot, "CLAUDE.md"), "utf-8");
      } catch {
        content = "# CLAUDE.md\n\nNo CLAUDE.md found in REPO_ROOT.";
      }
      return { contents: [{ uri: "basicoseng://config/CLAUDE.md", mimeType: "text/markdown", text: content }] };
    },
  );
};
