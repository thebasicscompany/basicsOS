#!/usr/bin/env bun
/**
 * Syncs company assets from the root `assets/` folder to each app.
 * Run after replacing files in `assets/` with your company's branding.
 *
 * Usage: bun run assets:sync
 */

import { copyFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join, basename } from "path";

const ROOT = join(import.meta.dir, "..");
const SRC = join(ROOT, "assets");

const TARGETS = [
  join(ROOT, "apps/web/public"),
  join(ROOT, "apps/mobile/assets"),
  join(ROOT, "apps/desktop/resources"),
];

let copied = 0;

for (const target of TARGETS) {
  mkdirSync(target, { recursive: true });

  for (const file of readdirSync(SRC)) {
    if (file === "README.md") continue;
    const src = join(SRC, file);
    const dest = join(target, basename(file));
    copyFileSync(src, dest);
    console.log(`  ✓ ${file} → ${target.replace(ROOT, "")}`);
    copied++;
  }
}

console.log(`\nSynced ${copied} file(s) from assets/ to all apps.`);
