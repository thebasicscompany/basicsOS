#!/usr/bin/env node
/**
 * BasicsOS setup script — automates dev and production setup.
 * Run from repo root: pnpm run setup
 *
 * Prerequisites: Node 22+, pnpm 10+, Docker, Git
 */

import { spawnSync } from "child_process";
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { randomBytes } from "crypto";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SERVER = join(ROOT, "packages", "server");
const ENV_EXAMPLE = join(SERVER, ".env.example");
const ENV_FILE = join(SERVER, ".env");

// --- Helpers ---
function run(cmd, args, opts = {}) {
  const { cwd = ROOT, stdio = "inherit" } = opts;
  const r = spawnSync(cmd, args, { cwd, stdio, shell: true });
  if (r.status !== 0 && !opts.allowFail) {
    console.error(`\nFailed: ${cmd} ${args.join(" ")}`);
    process.exit(1);
  }
  return r;
}

function check(cmd, args = ["--version"]) {
  const r = spawnSync(cmd, args, { stdio: "pipe", shell: true });
  return r.status === 0;
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve((ans || "").trim());
    });
  });
}

function choose(question, options) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const opts = options.map((o, i) => `  [${i + 1}] ${o.label}`).join("\n");
  const promptStr = `${question}\n${opts}\nChoice (1–${options.length}): `;

  return new Promise((resolve) => {
    const ask = () => {
      rl.question(promptStr, (ans) => {
        const n = parseInt(ans, 10);
        if (n >= 1 && n <= options.length) {
          rl.close();
          resolve(options[n - 1].value);
        } else {
          console.log("Invalid choice. Try again.\n");
          ask();
        }
      });
    };
    ask();
  });
}

function generateSecret(bytes = 32, encoding = "base64") {
  return randomBytes(bytes).toString(encoding);
}

// --- Steps ---
function checkPrereqs() {
  console.log("\n--- Checking prerequisites ---\n");
  const required = [
    { cmd: "node", msg: "Node.js 22+" },
    { cmd: "pnpm", msg: "pnpm 10+" },
    { cmd: "docker", msg: "Docker" },
    { cmd: "git", msg: "Git" },
  ];
  let ok = true;
  for (const { cmd, msg } of required) {
    const has = check(cmd);
    console.log(`  ${has ? "✓" : "✗"} ${msg}`);
    if (!has) ok = false;
  }
  if (!ok) {
    console.error("\nInstall missing tools and run setup again.");
    process.exit(1);
  }
  console.log("");
}

async function askMode() {
  return choose("Deploy for development or production?", [
    {
      label:
        "Development — local Postgres, dev admin (admin@example.com), seed DB",
      value: "dev",
    },
    {
      label: "Production — migrations only, no seed, you provide env vars",
      value: "prod",
    },
  ]);
}

function install() {
  console.log("--- Installing dependencies ---\n");
  run("pnpm", ["install"]);
  console.log("");
}

function startPostgres() {
  console.log("--- Starting Postgres (Docker) ---\n");
  run("docker", ["compose", "up", "-d"]);
  console.log("");
}

async function createEnv(mode) {
  console.log("--- Configuring environment ---\n");

  if (existsSync(ENV_FILE)) {
    const overwrite = await prompt(
      `packages/server/.env already exists. Overwrite? [y/N]: `,
    );
    if (overwrite.toLowerCase() !== "y") {
      console.log("Skipping .env creation.\n");
      return;
    }
  }

  let content = readFileSync(ENV_EXAMPLE, "utf8");
  const authSecret = generateSecret(32, "base64");
  const encKey = generateSecret(32, "hex");

  content = content.replace(
    "BETTER_AUTH_SECRET=generate-with-openssl-rand-base64-32",
    `BETTER_AUTH_SECRET=${authSecret}`,
  );
  content = content.replace(
    "API_KEY_ENCRYPTION_KEY=generate-32-byte-base64-or-hex",
    `API_KEY_ENCRYPTION_KEY=${encKey}`,
  );

  if (mode === "prod") {
    content = content.replace("NODE_ENV=development", "NODE_ENV=production");
  }

  writeFileSync(ENV_FILE, content);
  console.log("  Created packages/server/.env with generated secrets.\n");
}

async function createEnvProd() {
  if (!existsSync(ENV_FILE)) {
    await createEnv("prod");
  }
}

function migrate() {
  console.log("--- Running database migrations ---\n");
  run("pnpm", ["db:migrate"], { cwd: SERVER });
  console.log("");
}

function seed() {
  console.log("--- Seeding database (dev admin) ---\n");
  run("pnpm", ["db:seed"], { cwd: SERVER });
  console.log("");
}

function printDevDone() {
  console.log(`
--- Setup complete (development) ---

Run the app:
  pnpm run dev:all

Log in with:
  Email: admin@example.com
  Password: admin123

`);
}

function printProdDone() {
  console.log(`
--- Setup complete (production) ---

Before going live, set these in packages/server/.env:

  DATABASE_URL      — Production Postgres (SSL, strong creds)
  BETTER_AUTH_URL  — Your API base URL (e.g. https://api.yourcompany.com)
  ALLOWED_ORIGINS  — Same as BETTER_AUTH_URL (or comma-separated list)

Do NOT run pnpm db:seed in production. The first user to sign up becomes admin.

Run migrations on deploy:
  cd packages/server && pnpm db:migrate

`);
}

// --- Main ---
async function main() {
  console.log("\nBasicsOS Setup\n");

  checkPrereqs();
  const mode = await askMode();

  if (mode === "dev") {
    install();
    startPostgres();
    await createEnv("dev");
    migrate();
    seed();
    printDevDone();
  } else {
    const startLocalPostgres = await prompt(
      "Start local Postgres via Docker for this machine? [y/N]: ",
    );
    install();
    if (startLocalPostgres.toLowerCase() === "y") {
      startPostgres();
    } else {
      console.log(
        "\nSkipping Docker Postgres. Ensure DATABASE_URL points to your database.\n",
      );
    }
    await createEnv("prod");
    migrate();
    printProdDone();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
