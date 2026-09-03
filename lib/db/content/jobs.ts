import { sql } from "@/lib/db/client";
import { mapGenerationJob } from "./map";
import type { GenerationJob, JobKind } from "@/lib/content/types";

// Postgres-backed work queue.
//
// Chosen over a queue vendor because the volume is small, job state is exactly
// what the dashboard needs to display anyway, and it adds no new secrets or
// webhook surface. Claiming uses FOR UPDATE SKIP LOCKED so several workers can
// run without coordinating: each transaction locks a different row, and a row
// already locked is skipped rather than waited on.

export interface EnqueueInput {
  kind: JobKind;
  variantId?: number | null;
  campaignId?: number | null;
  accountId?: number | null;
  payload?: Record<string, unknown>;
  /** Makes enqueue idempotent: a retried request returns the existing job
   *  rather than creating a duplicate. */
  idempotencyKey?: string | null;
  runAfter?: Date | null;
  maxAttempts?: number;
}

export async function enqueueJob(input: EnqueueInput): Promise<GenerationJob> {
  const payload = JSON.stringify(input.payload ?? {});
  // The DO UPDATE is a deliberate no-op write: ON CONFLICT DO NOTHING returns no
  // row, so a duplicate enqueue would yield undefined instead of the job that
  // already exists. Touching updated_at to its own value returns the existing
  // row unchanged. Rows with a null idempotency_key never conflict, since NULL
  // is not equal to NULL in a unique index, so unkeyed enqueues always insert.
  const result = await sql`
    INSERT INTO generation_jobs (
      kind, variant_id, campaign_id, account_id, payload,
      idempotency_key, run_after, max_attempts
    )
    VALUES (
      ${input.kind}, ${input.variantId ?? null}, ${input.campaignId ?? null},
      ${input.accountId ?? null}, ${payload}::jsonb,
      ${input.idempotencyKey ?? null},
      ${input.runAfter ?? new Date()}, ${input.maxAttempts ?? 3}
    )
    ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = generation_jobs.updated_at
    RETURNING *
  `;
  return mapGenerationJob(result.rows[0]);
}

/**
 * Atomically claims the next runnable job for this worker.
 *
 * A job is runnable when it is queued and its run_after has passed, OR when it
 * was claimed but its lease expired, which is how a crashed worker's job
 * becomes available again rather than being stuck in 'running' forever.
 */
export async function claimNextJob(
  workerId: string,
  leaseSeconds = 900,
): Promise<GenerationJob | null> {
  const result = await sql`
    UPDATE generation_jobs
    SET status = 'running',
        claimed_by = ${workerId},
        claimed_at = now(),
        attempts = attempts + 1,
        updated_at = now()
    WHERE id = (
      SELECT id FROM generation_jobs
      WHERE (
        (status = 'queued' AND run_after <= now())
        OR (
          status = 'running'
          AND claimed_at < now() - make_interval(secs => ${leaseSeconds})
        )
      )
      ORDER BY run_after
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `;
  const row = result.rows[0];
  return row ? mapGenerationJob(row) : null;
}

export async function completeJob(id: number, costCents = 0): Promise<void> {
  await sql`
    UPDATE generation_jobs
    SET status = 'succeeded', cost_cents = cost_cents + ${costCents},
        last_error = NULL, updated_at = now()
    WHERE id = ${id}
  `;
}

/**
 * Records a failure. A job with attempts left goes back to 'queued' with
 * exponential backoff; one that has exhausted them stays 'failed' so a human
 * decides what happens next. Partial batch failure never discards the items
 * that succeeded, because each item is its own job row.
 */
export async function failJob(id: number, error: string): Promise<void> {
  await sql`
    UPDATE generation_jobs
    SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
        -- Exponential backoff capped at 15 minutes: 60s, 120s, 240s, 480s, 900s.
        -- attempts is capped before exponentiation so a high retry count cannot
        -- overflow, and the whole expression is cast once for make_interval.
        run_after = now() + make_interval(
          secs => LEAST(900, 30 * POWER(2, LEAST(attempts, 5)))::double precision
        ),
        last_error = ${error.slice(0, 2000)},
        claimed_by = NULL,
        claimed_at = NULL,
        updated_at = now()
    WHERE id = ${id}
  `;
}

export async function listJobs(limit = 100): Promise<GenerationJob[]> {
  const result = await sql`
    SELECT * FROM generation_jobs ORDER BY created_at DESC LIMIT ${limit}
  `;
  return result.rows.map(mapGenerationJob);
}

export async function retryJob(id: number): Promise<void> {
  await sql`
    UPDATE generation_jobs
    SET status = 'queued', attempts = 0, run_after = now(),
        last_error = NULL, claimed_by = NULL, claimed_at = NULL, updated_at = now()
    WHERE id = ${id}
  `;
}

export async function cancelJob(id: number): Promise<void> {
  await sql`
    UPDATE generation_jobs SET status = 'canceled', updated_at = now()
    WHERE id = ${id} AND status IN ('queued','failed')
  `;
}
