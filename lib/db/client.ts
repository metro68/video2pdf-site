import { Pool, type QueryResult, type QueryResultRow } from "pg";

// We connect to Supabase Postgres with the `pg` driver, NOT @vercel/postgres.
// @vercel/postgres is a Neon-only HTTP driver: given a Supabase POSTGRES_URL it
// rewrites the host to a Neon-style "api.pooler.supabase.com" that does not exist
// (ENOTFOUND) and every query fails. `pg` talks to Supabase directly. Supabase
// also serves a cert chain not in Node's default trust store, so we set
// ssl rejectUnauthorized:false (connection stays encrypted) and strip any sslmode
// from the URL, which would otherwise force chain verification. This mirrors the
// server's client (video2pdf-app/server/src/db/client.ts).
function buildConnectionString(): string | undefined {
  const raw = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return raw;
  }
}

let cachedPool: Pool | null = null;
function getPool(): Pool {
  if (!cachedPool) {
    cachedPool = new Pool({
      connectionString: buildConnectionString(),
      max: 3,
      ssl: { rejectUnauthorized: false },
    });
  }
  return cachedPool;
}

// Tagged-template `sql` compatible with the previous @vercel/postgres interface:
// `await sql\`SELECT ... ${value}\`` returns a { rows } result. Interpolated values
// become parameterized $1, $2, ... placeholders, so there is no SQL injection.
export function sql<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult<T>> {
  let text = "";
  strings.forEach((part, i) => {
    text += part;
    if (i < values.length) text += `$${i + 1}`;
  });
  return getPool().query<T>(text, values);
}

export type Plan = "weekly" | "annual";
export type SubStatus = "trialing" | "active" | "past_due" | "canceled";

export interface SubscriptionRow {
  email: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: Plan;
  status: SubStatus;
  currentPeriodEnd: number | null;
  trialEnd: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface RedeemTokenRow {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  consumedAt: number | null;
}

const ms = (v: unknown): number | null =>
  v == null ? null : v instanceof Date ? v.getTime() : Date.parse(String(v));

export function mapSubscriptionRow(r: Record<string, unknown>): SubscriptionRow {
  return {
    email: String(r.email),
    stripeCustomerId: (r.stripe_customer_id as string) ?? null,
    stripeSubscriptionId: (r.stripe_subscription_id as string) ?? null,
    plan: r.plan as Plan,
    status: r.status as SubStatus,
    currentPeriodEnd: ms(r.current_period_end),
    trialEnd: ms(r.trial_end),
    createdAt: ms(r.created_at) ?? 0,
    updatedAt: ms(r.updated_at) ?? 0,
  };
}

export function mapRedeemTokenRow(r: Record<string, unknown>): RedeemTokenRow {
  return {
    token: String(r.token),
    email: String(r.email),
    createdAt: ms(r.created_at) ?? 0,
    expiresAt: ms(r.expires_at) ?? 0,
    consumedAt: ms(r.consumed_at),
  };
}
