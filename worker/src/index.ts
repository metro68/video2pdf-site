import { hostname } from "node:os";
import { closePool } from "./db.js";
import { claimNext, complete, fail } from "./jobs.js";
import { HANDLERS, type HandlerContext } from "./handlers.js";

// Poll loop. No inbound HTTP: the worker only makes outbound calls, so there is
// no endpoint to authenticate or expose.

const WORKER_ID = process.env.WORKER_ID ?? `${hostname()}-${process.pid}`;
const DRY_RUN = process.env.WORKER_DRY_RUN === "1";
const IDLE_MS = Number(process.env.WORKER_IDLE_MS ?? 5000);

let running = true;

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

const ctx: HandlerContext = { dryRun: DRY_RUN, log };

async function tick(): Promise<boolean> {
  const job = await claimNext(WORKER_ID);
  if (!job) return false;

  log(`claimed job ${job.id} (${job.kind}, attempt ${job.attempts}/${job.maxAttempts})`);

  try {
    const handler = HANDLERS[job.kind];
    if (!handler) throw new Error(`no handler for job kind ${job.kind}`);
    const costCents = await handler(job, ctx);
    await complete(job.id, costCents);
    log(`job ${job.id} succeeded${costCents ? ` (${costCents}c)` : ""}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await fail(job.id, message);
    // A job with attempts remaining is requeued with backoff by fail(); one
    // that has exhausted them stays failed for a human to look at.
    log(`job ${job.id} failed: ${message}`);
  }
  return true;
}

async function main(): Promise<void> {
  log(`worker ${WORKER_ID} starting${DRY_RUN ? " (DRY RUN: no live publishing)" : ""}`);

  if (!DRY_RUN) {
    log("WARNING: dry run is off. Publish jobs will attempt live posts.");
  }

  while (running) {
    let worked = false;
    try {
      worked = await tick();
    } catch (err) {
      // A failure here is infrastructure, not job logic (the handler's own
      // errors are caught above). Back off rather than spinning.
      log(`poll error: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!worked) {
      await new Promise((r) => setTimeout(r, IDLE_MS));
    }
  }

  await closePool();
  log("worker stopped");
}

// Finish the job in flight before exiting, so a deploy does not orphan a
// half-written variant. The lease would recover it, but cleanly is better.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log(`${signal} received, finishing current job then stopping`);
    running = false;
  });
}

main().catch((err) => {
  console.error("worker crashed:", err);
  process.exit(1);
});
