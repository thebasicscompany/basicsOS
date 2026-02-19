"use strict";
const pg = require("pg");
const fs = require("fs");
const path = require("path");

const { Client } = pg;

const MIGRATIONS = [
  "packages/db/migrations/0001_exotic_kulan_gath.sql",
  "packages/db/migrations/0002_module_config_llm_usage.sql",
];

const runStatements = async (client, sql, label) => {
  const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
  console.log(`\n--- ${label} (${statements.length} statements) ---`);
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      console.log("✓", stmt.slice(0, 70).replace(/\n/g, " "));
    } catch (e) {
      if (e.message.includes("already exists") || e.message.includes("duplicate")) {
        console.log("⚠ already exists:", stmt.slice(0, 70).replace(/\n/g, " "));
      } else {
        console.error("✗ ERROR:", e.message);
        console.error("  stmt:", stmt.slice(0, 100));
      }
    }
  }
};

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  for (const migrationPath of MIGRATIONS) {
    const sql = fs.readFileSync(path.join(__dirname, migrationPath), "utf-8");
    await runStatements(client, sql, migrationPath);
  }

  await client.end();
  console.log("\nDone.");
}

run().catch(err => { console.error(err); process.exit(1); });
