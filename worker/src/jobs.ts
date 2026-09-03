import { query } from "./db.js";

export type JobKind =
  | "concept"
  | "script"
  | "images"
  | "render"
  | "publish"
  | "sync_metrics"
  | "collect_public";

export interface Job {
  id: number;
  kind: JobKind;
  variantId: number | null;
  campaignId: number | null;
  accountId: number | null;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

interface JobRow {
  id: string | number;
  kind: JobKind;
  variant_id: string | number | null;
  campaign_id: string | number | null;
  account_id: string | number | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

const n = (v: string | number | null): number | null => (v == null ? null : Number(v));

/**
 * Claims the next runnable job. FOR UPDATE SKIP LOCKED means concurrent workers
 * take different rows rather than blocking on each other. A job whose lease has
 * expired is reclaimable, which is how a crashed worker's row is recovered.
 */
export async function claimNext(workerId: string, leaseSeconds = 900): Promise<Job | null> {
  const result = await query<JobRow>(
    `UPDATE generation_jobs
     SET status = 'running', claimed_by = $1, claimed_at = now(),
         attempts = attempts + 1, updated_at = now()
     WHERE id = (
       SELECT id FROM generation_jobs
       WHERE (status = 'queued' AND run_after <= now())
          OR (status = 'running' AND claimed_at < now() - make_interval(secs => $2))
       ORDER BY run_after
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING id, kind, variant_id, campaign_id, account_id, payload, attempts, max_attempts`,
    [workerId, leaseSeconds],
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    kind: row.kind,
    variantId: n(row.variant_id),
    campaignId: n(row.campaign_id),
    accountId: n(row.account_id),
    payload: row.payload ?? {},
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
  };
}

export async function complete(id: number, costCents = 0): Promise<void> {
  await query(
    `UPDATE generation_jobs
     SET status = 'succeeded', cost_cents = cost_cents + $2,
         last_error = NULL, updated_at = now()
     WHERE id = $1`,
    [id, costCents],
  );
}

export async function fail(id: number, message: string): Promise<void> {
  await query(
    `UPDATE generation_jobs
     SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
         run_after = now() + make_interval(
           secs => LEAST(900, 30 * POWER(2, LEAST(attempts, 5)))::double precision
         ),
         last_error = $2, claimed_by = NULL, claimed_at = NULL, updated_at = now()
     WHERE id = $1`,
    [id, message.slice(0, 2000)],
  );
}

/** Adds to a campaign's recorded spend and returns the new total. Increment and
 *  read happen in one statement so concurrent workers cannot both observe the
 *  pre-increment value. */
export async function addSpend(campaignId: number, cents: number): Promise<number> {
  const result = await query<{ spent_cents: string | number }>(
    `UPDATE campaigns SET spent_cents = spent_cents + $2, updated_at = now()
     WHERE id = $1 RETURNING spent_cents`,
    [campaignId, cents],
  );
  return Number(result.rows[0]?.spent_cents ?? 0);
}

/** Budget headroom check, run before spending rather than after. */
export async function hasBudget(campaignId: number, estimateCents: number): Promise<boolean> {
  const result = await query<{ image_budget_cents: number | null; spent_cents: string | number }>(
    `SELECT image_budget_cents, spent_cents FROM campaigns WHERE id = $1`,
    [campaignId],
  );
  const row = result.rows[0];
  if (!row) return false;
  if (row.image_budget_cents == null) return true;
  return Number(row.spent_cents) + estimateCents <= row.image_budget_cents;
}
