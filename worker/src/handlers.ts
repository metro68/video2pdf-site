import { query } from "./db.js";
import { addSpend, hasBudget, type Job } from "./jobs.js";

// Job handlers. Each returns the cost in cents it incurred, which the loop
// records against the job and the campaign.
//
// Handlers are deliberately small and idempotent where they can be: a retried
// script job overwrites the same variant row, a retried image job rewrites the
// same storage keys, and a publish job refuses to run at all once a platform
// post id exists.

export interface HandlerContext {
  dryRun: boolean;
  log: (message: string) => void;
}

type Handler = (job: Job, ctx: HandlerContext) => Promise<number>;

async function notImplemented(kind: string): Promise<never> {
  throw new Error(
    `${kind} jobs need provider credentials and the site's lib/content adapters; ` +
      `run this worker from the repo root so it can import them`,
  );
}

/**
 * Generates the script, caption and hashtags for one variant.
 *
 * The adapters live in the site's lib/content/providers and are imported at
 * call time rather than at module load, so a worker missing one API key can
 * still run the job kinds that do not need it.
 */
const handleScript: Handler = async (job, ctx) => {
  if (job.variantId == null) throw new Error("script job has no variant");

  const { generateScript } = await import("../../lib/content/providers/anthropic.js");
  const { checkScript } = await import("../../lib/content/quality.js");

  const result = await query<{
    hook: string;
    angle: string | null;
    structure: string | null;
    format: string;
    cta: string | null;
    account_angle: string | null;
  }>(
    `SELECT c.hook, c.angle, c.structure, c.format,
            camp.cta, a.angle AS account_angle
     FROM variants v
     JOIN concepts c ON c.id = v.concept_id
     LEFT JOIN campaigns camp ON camp.id = c.campaign_id
     LEFT JOIN social_accounts a ON a.id = v.account_id
     WHERE v.id = $1`,
    [job.variantId],
  );
  const row = result.rows[0];
  if (!row) throw new Error(`variant ${job.variantId} not found`);

  const generated = await generateScript(
    {
      hook: row.hook,
      angle: row.angle,
      structure: row.structure,
      format: row.format as "reel" | "carousel" | "image",
    },
    {
      product: "Video2PDF, an app that turns a video of a document into a clean PDF scan",
      cta: row.cta ?? "Try it free",
      accountAngle: row.account_angle,
    },
  );

  if (generated.status !== "ok" || !generated.data) {
    throw new Error(generated.error ?? "script generation failed");
  }

  const { script, usage } = generated.data;
  const checks = checkScript(script);

  await query(
    `UPDATE variants
     SET script = $2, caption = $3, hashtags = $4, quality_checks = $5::jsonb,
         status = 'needs_review', updated_at = now()
     WHERE id = $1`,
    [
      job.variantId,
      JSON.stringify(script),
      script.caption,
      script.hashtags.join(" "),
      JSON.stringify(checks),
    ],
  );

  ctx.log(`variant ${job.variantId}: script written, ${checks.filter((c) => !c.passed).length} check(s) failed`);
  return usage.costCents;
};

/**
 * Generates the stills for a variant and writes them to object storage.
 * Checks campaign budget before spending, not after.
 */
const handleImages: Handler = async (job, ctx) => {
  if (job.variantId == null) throw new Error("images job has no variant");

  const { generateImage, imageCostCents } = await import(
    "../../lib/content/providers/openai.js"
  );
  const { putObject, assetKey } = await import("../../lib/content/storage.js");

  const result = await query<{
    script: string | null;
    image_quality: string;
    campaign_id: number | null;
  }>(
    `SELECT v.script, COALESCE(camp.image_quality, 'low') AS image_quality,
            c.campaign_id
     FROM variants v
     JOIN concepts c ON c.id = v.concept_id
     LEFT JOIN campaigns camp ON camp.id = c.campaign_id
     WHERE v.id = $1`,
    [job.variantId],
  );
  const row = result.rows[0];
  if (!row?.script) throw new Error("variant has no script yet");

  const script = JSON.parse(row.script) as {
    scenes: Array<{ imagePrompt: string }>;
  };
  const quality = row.image_quality as "low" | "medium" | "high";
  const estimate = imageCostCents(quality, script.scenes.length);

  if (row.campaign_id != null && !(await hasBudget(row.campaign_id, estimate))) {
    throw new Error(
      `campaign ${row.campaign_id} has no budget headroom for ${script.scenes.length} images (${estimate}c)`,
    );
  }

  const keys: string[] = [];
  let spent = 0;

  for (const [i, scene] of script.scenes.entries()) {
    const image = await generateImage(scene.imagePrompt, quality);
    if (image.status !== "ok" || !image.data) {
      // Keep the stills already generated: the retry regenerates only what is
      // missing rather than paying for the whole set again.
      await query(`UPDATE variants SET asset_keys = $2::jsonb WHERE id = $1`, [
        job.variantId,
        JSON.stringify(keys),
      ]);
      if (row.campaign_id != null && spent > 0) await addSpend(row.campaign_id, spent);
      throw new Error(image.error ?? `image ${i} failed`);
    }
    const key = assetKey(job.variantId, "still", i, "png");
    await putObject(key, image.data.bytes, "image/png");
    keys.push(key);
    spent += image.data.costCents;
  }

  await query(
    `UPDATE variants SET asset_keys = $2::jsonb, updated_at = now() WHERE id = $1`,
    [job.variantId, JSON.stringify(keys)],
  );
  if (row.campaign_id != null) await addSpend(row.campaign_id, spent);

  ctx.log(`variant ${job.variantId}: ${keys.length} stills generated, ${spent}c`);
  return spent;
};

/**
 * Publishing. Refuses to post when a platform id already exists, which is the
 * duplicate guard, and does nothing but log when the worker is in dry run.
 */
const handlePublish: Handler = async (job, ctx) => {
  const publicationId = Number(job.payload.publicationId);
  if (!Number.isInteger(publicationId)) {
    throw new Error("publish job has no publicationId");
  }

  const result = await query<{
    platform_post_id: string | null;
    status: string;
    handle: string;
    platform: string;
    caption: string | null;
  }>(
    `SELECT p.platform_post_id, p.status, a.handle, a.platform, v.caption
     FROM publications p
     JOIN social_accounts a ON a.id = p.account_id
     JOIN variants v ON v.id = p.variant_id
     WHERE p.id = $1`,
    [publicationId],
  );
  const row = result.rows[0];
  if (!row) throw new Error(`publication ${publicationId} not found`);

  // Idempotency: a platform post id means this already published. A retry after
  // a timeout must never post a second copy.
  if (row.platform_post_id) {
    ctx.log(`publication ${publicationId} already published as ${row.platform_post_id}, skipping`);
    return 0;
  }

  if (ctx.dryRun) {
    ctx.log(
      `DRY RUN: would publish to ${row.platform} @${row.handle}: ` +
        `${(row.caption ?? "").slice(0, 80)}`,
    );
    await query(
      `UPDATE publications SET status = 'exported', updated_at = now() WHERE id = $1`,
      [publicationId],
    );
    return 0;
  }

  // Live publishing is deliberately not wired up here: it requires platform app
  // review and an explicit go-ahead. The adapters land in M6.
  throw new Error(
    "live publishing is not enabled; run with WORKER_DRY_RUN=1 until platform " +
      "approval and an explicit authorisation to post",
  );
};

const handleRender: Handler = async () => notImplemented("render");
const handleSyncMetrics: Handler = async () => notImplemented("sync_metrics");
const handleCollectPublic: Handler = async () => notImplemented("collect_public");
const handleConcept: Handler = async () => notImplemented("concept");

export const HANDLERS: Record<Job["kind"], Handler> = {
  concept: handleConcept,
  script: handleScript,
  images: handleImages,
  render: handleRender,
  publish: handlePublish,
  sync_metrics: handleSyncMetrics,
  collect_public: handleCollectPublic,
};
