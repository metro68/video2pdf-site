// Applies lib/db/schema.sql to the Postgres database (subscriptions + redeem_tokens).
// Run once after provisioning the DB in Vercel Storage:  npm run db:setup
//
// Connection: uses POSTGRES_URL from the environment. Locally, it also loads
// POSTGRES_URL (or DATABASE_URL as a fallback) from .env.local if present.
// In CI or `vercel env pull`ed shells, the injected POSTGRES_URL is used directly.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// Minimal .env.local loader (no dotenv dependency). Only fills vars not already set.
function loadEnvLocal() {
  const envPath = join(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  // Use POSTGRES_URL (Supabase-injected by Vercel), or DATABASE_URL as a fallback.
  let connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "No POSTGRES_URL found. Provision the database in Vercel Storage and either\n" +
        "run `vercel env pull .env.local`, or paste POSTGRES_URL into .env.local, then retry.",
    );
    process.exit(1);
  }

  // Strip sslmode from the URL so our explicit ssl config applies (same as the app
  // client). We connect with the pg driver, not @vercel/postgres, which is Neon-only
  // and cannot reach Supabase.
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    connectionString = url.toString();
  } catch {
    // Not a parseable URL; use as-is.
  }

  const schemaPath = join(root, "lib", "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf8");

  const { default: pg } = await import("pg");
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // schema.sql is idempotent (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
  await client.query(schema);
  await client.end();

  console.log("Schema applied: subscriptions + redeem_tokens are ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error("db:setup failed:", err.message ?? err);
  process.exit(1);
});
