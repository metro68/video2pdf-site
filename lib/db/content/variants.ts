import { sql } from "@/lib/db/client";
import { mapVariant } from "./map";
import type { QualityCheck, Variant, VariantStatus } from "@/lib/content/types";

export async function listVariants(status?: VariantStatus): Promise<Variant[]> {
  const result = status
    ? await sql`SELECT * FROM variants WHERE status = ${status} ORDER BY created_at DESC`
    : await sql`SELECT * FROM variants ORDER BY created_at DESC`;
  return result.rows.map(mapVariant);
}

export async function getVariant(id: number): Promise<Variant | null> {
  const result = await sql`SELECT * FROM variants WHERE id = ${id}`;
  const row = result.rows[0];
  return row ? mapVariant(row) : null;
}

export async function createVariant(
  conceptId: number,
  accountId: number | null,
): Promise<Variant> {
  const result = await sql`
    INSERT INTO variants (concept_id, account_id, status)
    VALUES (${conceptId}, ${accountId}, 'draft')
    RETURNING *
  `;
  return mapVariant(result.rows[0]);
}

export async function setVariantStatus(
  id: number,
  status: VariantStatus,
  detail?: { rejectReason?: string | null; approvedBy?: string | null },
): Promise<void> {
  if (status === "approved") {
    await sql`
      UPDATE variants
      SET status = 'approved', approved_by = ${detail?.approvedBy ?? null},
          approved_at = now(), reject_reason = NULL, updated_at = now()
      WHERE id = ${id}
    `;
    return;
  }
  await sql`
    UPDATE variants
    SET status = ${status}, reject_reason = ${detail?.rejectReason ?? null},
        updated_at = now()
    WHERE id = ${id}
  `;
}

export interface SaveGeneratedInput {
  id: number;
  script?: string | null;
  caption?: string | null;
  hashtags?: string | null;
  assetKeys?: string[];
  renderKey?: string | null;
  qualityChecks?: QualityCheck[];
  status?: VariantStatus;
}

/** Persists generation output. Each field is written only when supplied, so a
 *  later stage (render) does not blank an earlier stage's output (script). */
export async function saveGenerated(input: SaveGeneratedInput): Promise<void> {
  const assetKeys = input.assetKeys ? JSON.stringify(input.assetKeys) : null;
  const checks = input.qualityChecks ? JSON.stringify(input.qualityChecks) : null;
  await sql`
    UPDATE variants
    SET script = COALESCE(${input.script ?? null}, script),
        caption = COALESCE(${input.caption ?? null}, caption),
        hashtags = COALESCE(${input.hashtags ?? null}, hashtags),
        asset_keys = COALESCE(${assetKeys}::jsonb, asset_keys),
        render_key = COALESCE(${input.renderKey ?? null}, render_key),
        quality_checks = COALESCE(${checks}::jsonb, quality_checks),
        status = COALESCE(${input.status ?? null}, status),
        updated_at = now()
    WHERE id = ${input.id}
  `;
}

/** Variants awaiting human approval, with their concept and account joined for
 *  the review queue. */
export interface ReviewRow extends Variant {
  hook: string;
  format: string;
  campaignId: number | null;
  accountHandle: string | null;
  accountPlatform: string | null;
}

export async function listForReview(): Promise<ReviewRow[]> {
  const result = await sql`
    SELECT v.*, c.hook, c.format, c.campaign_id,
           a.handle AS account_handle, a.platform AS account_platform
    FROM variants v
    JOIN concepts c ON c.id = v.concept_id
    LEFT JOIN social_accounts a ON a.id = v.account_id
    WHERE v.status IN ('needs_review','generating','failed')
    ORDER BY v.updated_at DESC
  `;
  return result.rows.map((r) => ({
    ...mapVariant(r),
    hook: String(r.hook),
    format: String(r.format),
    campaignId: r.campaign_id == null ? null : Number(r.campaign_id),
    accountHandle: r.account_handle == null ? null : String(r.account_handle),
    accountPlatform: r.account_platform == null ? null : String(r.account_platform),
  }));
}
