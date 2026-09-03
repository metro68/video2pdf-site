import pg from "pg";

// Mirrors the site's lib/db/client.ts connection handling: strip sslmode so our
// explicit ssl config applies, and do not verify the chain, since Supabase
// serves a cert not in Node's default trust store. The connection is still
// encrypted.
function connectionString(): string {
  const raw = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("POSTGRES_URL is not set");
  try {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return raw;
  }
}

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: connectionString(),
      max: 4,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, values);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
