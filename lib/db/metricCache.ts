import { sql } from "./client";

export interface DurableCacheEntry<T> {
  value: T;
  asOf: string;
}

// Durable, Postgres-backed cache for connector payloads. Every function is
// fault-tolerant: a missing table, missing POSTGRES_URL, or any query error
// degrades to "no cache" rather than breaking the caller, since the cache is
// an optimization layered over APIs that still work without it.

export async function getDurableCache<T>(key: string): Promise<DurableCacheEntry<T> | null> {
  try {
    const result = await sql<{ value: T; as_of: string }>`
      SELECT value, as_of FROM metric_cache WHERE key = ${key}
    `;
    const row = result.rows[0];
    if (!row) return null;
    return { value: row.value, asOf: new Date(row.as_of).toISOString() };
  } catch {
    return null;
  }
}

export async function setDurableCache(key: string, value: unknown): Promise<void> {
  try {
    const json = JSON.stringify(value);
    await sql`
      INSERT INTO metric_cache (key, value, as_of)
      VALUES (${key}, ${json}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, as_of = EXCLUDED.as_of
    `;
  } catch {
    // Best effort; the caller still has the fresh value in hand.
  }
}
