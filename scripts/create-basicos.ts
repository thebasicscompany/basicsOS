#!/usr/bin/env bun
/**
 * BasicOS — Interactive Setup CLI
 *
 * Usage (works on a fresh clone, no prior `bun install` needed):
 *   bun scripts/create-basicos.ts
 *   — or via package.json script —
 *   bun create
 *
 * What it does:
 *   1. Self-bootstraps @clack/prompts + picocolors if not installed yet
 *   2. Walks you through: company name → app selection → database → AI key
 *   3. Trims package.json workspaces to only the apps you picked
 *      (skipping Desktop saves ~200 MB, skipping Mobile saves ~500 MB)
 *   4. Runs `bun install` for only those workspaces
 *   5. Generates .env, optionally starts Docker, runs migrations + seed
 *   6. Saves your selections to .basicos-config.json for future re-runs
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ─── Self-bootstrap ───────────────────────────────────────────────────────────
// Install CLI deps if this is a fresh clone and bun install hasn't run yet.
const clackMissing = !existsSync(join(ROOT, "node_modules/@clack"));
const pcMissing = !existsSync(join(ROOT, "node_modules/picocolors"));

if (clackMissing || pcMissing) {
  process.stdout.write("Installing setup tools (one-time, ~2s)...\n");
  execSync("bun add --dev @clack/prompts picocolors", {
    cwd: ROOT,
    stdio: "inherit",
  });
  // Re-exec so Bun's module resolver picks up the newly installed packages.
  execSync(`bun ${fileURLToPath(import.meta.url)}`, { cwd: ROOT, stdio: "inherit" });
  process.exit(0);
}

// Dynamic imports — guaranteed available after the bootstrap above
const p = await import("@clack/prompts");
const { default: pc } = await import("picocolors");

// ─── Types ────────────────────────────────────────────────────────────────────
type AppKey = "web" | "desktop" | "mobile" | "mcp";
type AiProvider = "skip" | "anthropic" | "openai" | "managed";
type DbSetup = "docker" | "custom";

interface Profile {
  companyName?: string;
  selectedApps?: AppKey[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const escEnv = (v: string): string =>
  v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

function loadProfile(): Profile {
  const path = join(ROOT, ".basicos-config.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Profile;
  } catch {
    return {};
  }
}

function saveProfile(data: Profile): void {
  writeFileSync(
    join(ROOT, ".basicos-config.json"),
    JSON.stringify(data, null, 2) + "\n",
  );
}

function run(cmd: string, opts: { silent?: boolean } = {}): boolean {
  try {
    execSync(cmd, { cwd: ROOT, stdio: opts.silent ? "ignore" : "inherit" });
    return true;
  } catch {
    return false;
  }
}

function canceledCheck(value: unknown): asserts value is NonNullable<unknown> {
  if (p.isCancel(value)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const profile = loadProfile();
  console.clear();

  p.intro(pc.bgMagenta(pc.white(pc.bold(" BasicOS "))));

  p.note(
    [
      "This wizard installs only the apps you need.",
      "",
      pc.dim("Skipping Desktop saves ~200 MB of node_modules"),
      pc.dim("Skipping Mobile  saves ~500 MB of node_modules"),
      "",
      pc.dim("Re-run anytime to change your selection."),
    ].join("\n"),
    "Selective install",
  );

  // ── Company name ────────────────────────────────────────────────────────────
  const companyName = await p.text({
    message: "Company name",
    placeholder: "Acme Corp",
    defaultValue: profile.companyName ?? "Acme Corp",
  });
  canceledCheck(companyName);

  // ── App selection ───────────────────────────────────────────────────────────
  const selectedApps = await p.multiselect<AppKey, AppKey>({
    message: "Which apps do you need?",
    options: [
      {
        value: "web",
        label: "Web portal",
        hint: "Next.js — the main UI (recommended)",
      },
      {
        value: "desktop",
        label: "Desktop app",
        hint: "Electron — macOS / Windows / Linux  (~200 MB)",
      },
      {
        value: "mobile",
        label: "Mobile app",
        hint: "Expo — iOS & Android  (~500 MB)",
      },
      {
        value: "mcp",
        label: "MCP servers",
        hint: "Claude / ChatGPT tool integration",
      },
    ],
    initialValues: profile.selectedApps ?? ["web"],
    required: true,
  });
  canceledCheck(selectedApps);

  const apps = new Set(selectedApps as AppKey[]);

  // Show disk savings
  const savings: string[] = [];
  if (!apps.has("desktop")) savings.push("~200 MB (Desktop)");
  if (!apps.has("mobile")) savings.push("~500 MB (Mobile)");
  if (savings.length) {
    p.log.success(`Saving approximately ${savings.join(" + ")} of dependencies`);
  }

  // ── Database ─────────────────────────────────────────────────────────────────
  const database = await p.select<DbSetup, DbSetup>({
    message: "Database setup",
    options: [
      {
        value: "docker",
        label: "Docker",
        hint: "starts PostgreSQL + Redis automatically (recommended for dev)",
      },
      {
        value: "custom",
        label: "Existing PostgreSQL + Redis",
        hint: "enter your own connection URLs",
      },
    ],
  });
  canceledCheck(database);

  const defaultDb = "postgresql://basicos:basicos_dev@localhost:5432/basicos";
  const defaultRedis = "redis://localhost:6379";
  let dbUrl = defaultDb;
  let redisUrl = defaultRedis;

  if (database === "custom") {
    const customDb = await p.text({
      message: "PostgreSQL URL",
      placeholder: defaultDb,
      defaultValue: defaultDb,
    });
    canceledCheck(customDb);
    dbUrl = customDb as string;

    const customRedis = await p.text({
      message: "Redis URL",
      placeholder: defaultRedis,
      defaultValue: defaultRedis,
    });
    canceledCheck(customRedis);
    redisUrl = customRedis as string;
  }

  // ── AI features ──────────────────────────────────────────────────────────────
  const aiProvider = await p.select<AiProvider, AiProvider>({
    message: "AI features",
    options: [
      { value: "skip", label: "Skip", hint: "configure later — everything works without AI" },
      {
        value: "anthropic",
        label: "Anthropic API key",
        hint: "Claude — recommended for best results",
      },
      { value: "openai", label: "OpenAI API key", hint: "GPT-4o" },
      {
        value: "managed",
        label: "BasicOS managed key",
        hint: "basicsos.com/keys — covers all models, no accounts needed",
      },
    ],
  });
  canceledCheck(aiProvider);

  let aiKey: string | null = null;
  let aiKeyVar: string | null = null;
  let aiApiUrl: string | null = null;

  if (aiProvider !== "skip") {
    const keyPrompt: Record<AiProvider, string> = {
      skip: "",
      anthropic: "Anthropic API key",
      openai: "OpenAI API key",
      managed: "BasicOS managed key",
    };

    const keyPlaceholder: Record<AiProvider, string> = {
      skip: "",
      anthropic: "sk-ant-...",
      openai: "sk-...",
      managed: "bsk_live_...",
    };

    const enteredKey = await p.text({
      message: keyPrompt[aiProvider],
      placeholder: keyPlaceholder[aiProvider],
      validate: (v) => (v.trim() ? undefined : "API key is required"),
    });
    canceledCheck(enteredKey);

    aiKey = (enteredKey as string).trim();
    aiKeyVar =
      aiProvider === "anthropic"
        ? "ANTHROPIC_API_KEY"
        : aiProvider === "openai"
          ? "OPENAI_API_KEY"
          : "AI_API_KEY";
    if (aiProvider === "managed") aiApiUrl = "https://api.basicsos.com";
  }

  // ── Confirmation ─────────────────────────────────────────────────────────────
  const appsLabel = [...apps]
    .map((a) => ({ web: "Web", desktop: "Desktop", mobile: "Mobile", mcp: "MCP" }[a]))
    .join(", ");

  const proceed = await p.confirm({
    message: `Install ${pc.bold(appsLabel)} and set up the database?`,
    initialValue: true,
  });
  canceledCheck(proceed);
  if (!proceed) {
    p.cancel("No changes made.");
    process.exit(0);
  }

  // ── Apply all selections ──────────────────────────────────────────────────────
  const spinner = p.spinner();

  // 1. Patch package.json workspaces
  spinner.start("Configuring workspaces");
  const pkgPath = join(ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;

  // Stash the full glob patterns on first run so they can be restored later
  if (!pkg._workspacesAll) {
    pkg._workspacesAll = pkg.workspaces;
  }

  const workspaces: string[] = ["packages/*"];
  if (apps.has("web")) workspaces.push("apps/web");
  if (apps.has("desktop")) workspaces.push("apps/desktop");
  if (apps.has("mobile")) workspaces.push("apps/mobile");
  if (apps.has("mcp")) workspaces.push("apps/mcp/*");

  pkg.workspaces = workspaces;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  spinner.stop(`Workspaces → ${pc.dim(workspaces.join(", "))}`);

  // Save profile
  saveProfile({ companyName: companyName as string, selectedApps: [...apps] });

  // 2. Write .env
  spinner.start("Generating .env");
  if (existsSync(join(ROOT, ".env"))) {
    spinner.stop(".env already exists — skipped (delete to regenerate)");
  } else {
    const secret = randomBytes(32).toString("hex");
    const lines = [
      `# BasicOS — generated by bun create on ${new Date().toISOString()}`,
      `BASICOS_COMPANY_NAME="${escEnv(companyName as string)}"`,
      `DATABASE_URL="${escEnv(dbUrl)}"`,
      `REDIS_URL="${escEnv(redisUrl)}"`,
      `BETTER_AUTH_SECRET="${secret}"`,
      `BETTER_AUTH_URL=http://localhost:3000`,
      `NEXT_PUBLIC_APP_URL=http://localhost:3000`,
      `NEXT_PUBLIC_API_URL=http://localhost:3001`,
      `EXPO_PUBLIC_APP_URL=http://localhost:3000`,
      ``,
      `# AI features`,
    ];

    if (aiKey && aiKeyVar) {
      lines.push(`${aiKeyVar}="${escEnv(aiKey)}"`);
      if (aiApiUrl) lines.push(`AI_API_URL="${aiApiUrl}"`);
    } else {
      lines.push(`# ANTHROPIC_API_KEY=sk-ant-...`);
      lines.push(`# OPENAI_API_KEY=sk-...`);
    }

    lines.push(``, `BASICOS_ACCENT_COLOR="#6366f1"`);
    writeFileSync(join(ROOT, ".env"), lines.join("\n") + "\n");
    spinner.stop(".env written");
  }

  // 3. bun install (only selected workspaces' deps)
  spinner.start(
    apps.size < 4
      ? "Installing dependencies (faster — skipped unused apps)"
      : "Installing dependencies",
  );
  p.log.step(""); // blank line before bun's output
  const installOk = run("bun install");
  if (!installOk) {
    spinner.stop(pc.red("bun install failed"));
    p.cancel("Check the error output above and re-run bun create.");
    process.exit(1);
  }
  spinner.stop("Dependencies installed");

  // 4. Docker
  if (database === "docker") {
    spinner.start("Starting PostgreSQL + Redis via Docker");
    const dockerOk = run("docker compose up -d postgres redis", { silent: true });
    if (!dockerOk) {
      spinner.stop(pc.yellow("Docker failed — ensure Docker Desktop is running"));
      p.log.warn("Start manually: docker compose up -d");
    } else {
      // Poll until pg_isready
      let ready = false;
      for (let i = 0; i < 15; i++) {
        await new Promise<void>((r) => setTimeout(r, 2000));
        if (run("docker compose exec -T postgres pg_isready -U basicos", { silent: true })) {
          ready = true;
          break;
        }
      }
      spinner.stop(
        ready
          ? "PostgreSQL + Redis ready"
          : pc.yellow("Containers started — database may still be initializing"),
      );
    }
  }

  // 5. Migrations
  spinner.start("Running database migrations");
  const migrateOk = run("bun db:migrate");
  spinner.stop(
    migrateOk
      ? "Schema migrated"
      : pc.yellow("Migration failed — run manually: bun db:migrate"),
  );

  // 6. Seed
  spinner.start("Seeding demo data");
  const seedOk = run("bun db:seed");
  spinner.stop(
    seedOk ? "Demo data seeded" : pc.yellow("Seed skipped — run manually: bun db:seed"),
  );

  // ── Done ──────────────────────────────────────────────────────────────────────
  const startLines: string[] = [];
  if (apps.has("web") || apps.has("mcp")) {
    startLines.push(pc.bold("Start the API first:"));
    startLines.push("  bun --filter @basicsos/api dev      # port 3001");
  }
  if (apps.has("web")) {
    startLines.push("");
    startLines.push(pc.bold("Web portal:"));
    startLines.push("  bun --filter @basicsos/web dev      # port 3000");
  }
  if (apps.has("desktop")) {
    startLines.push("");
    startLines.push(pc.bold("Desktop app:") + pc.dim("  (requires web on :3000)"));
    startLines.push("  bun --filter @basicsos/desktop dev");
  }
  if (apps.has("mobile")) {
    startLines.push("");
    startLines.push(pc.bold("Mobile app:"));
    startLines.push("  bun --filter @basicsos/mobile dev");
  }
  if (apps.has("mcp")) {
    startLines.push("");
    startLines.push(pc.bold("MCP servers:"));
    startLines.push("  bun --filter @basicsos/mcp-company dev");
    startLines.push("  bun --filter @basicsos/mcp-engineer dev");
  }

  startLines.push("");
  startLines.push(pc.bold("Login:"));
  startLines.push("  admin@acme.example.com  /  password");

  if (apps.size < 4) {
    startLines.push("");
    startLines.push(pc.dim("To add more apps later, re-run: bun create"));
  }

  p.note(startLines.join("\n"), "You're all set!");
  p.outro(pc.green("✓ BasicOS is ready"));
}

main().catch((err: unknown) => {
  p.cancel(`Setup failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
