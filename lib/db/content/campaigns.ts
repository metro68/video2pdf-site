import { sql } from "@/lib/db/client";
import { mapCampaign, mapConcept } from "./map";
import type {
  Campaign,
  CampaignStatus,
  Concept,
  ContentFormat,
  ImageQuality,
} from "@/lib/content/types";

export async function listCampaigns(): Promise<Campaign[]> {
  const result = await sql`
    SELECT id, name, objective, audience, cta, destination_path,
           utm_campaign, image_quality, image_budget_cents, spent_cents, status,
           created_at, updated_at
    FROM campaigns
    ORDER BY status, created_at DESC
  `;
  return result.rows.map(mapCampaign);
}

export async function getCampaign(id: number): Promise<Campaign | null> {
  const result = await sql`
    SELECT id, name, objective, audience, cta, destination_path,
           utm_campaign, image_quality, image_budget_cents, spent_cents, status,
           created_at, updated_at
    FROM campaigns WHERE id = ${id}
  `;
  const row = result.rows[0];
  return row ? mapCampaign(row) : null;
}

export interface CreateCampaignInput {
  name: string;
  objective?: string | null;
  audience?: string | null;
  cta?: string | null;
  destinationPath?: string;
  utmCampaign?: string | null;
  imageQuality?: ImageQuality;
  imageBudgetCents?: number | null;
}

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  const result = await sql`
    INSERT INTO campaigns (name, objective, audience, cta, destination_path,
                           utm_campaign, image_quality, image_budget_cents)
    VALUES (${input.name}, ${input.objective ?? null}, ${input.audience ?? null},
            ${input.cta ?? null}, ${input.destinationPath ?? "/go"},
            ${input.utmCampaign ?? null}, ${input.imageQuality ?? "low"},
            ${input.imageBudgetCents ?? null})
    RETURNING id, name, objective, audience, cta, destination_path,
              utm_campaign, image_quality, image_budget_cents, spent_cents, status,
              created_at, updated_at
  `;
  return mapCampaign(result.rows[0]);
}

export async function setCampaignStatus(
  id: number,
  status: CampaignStatus,
): Promise<void> {
  await sql`
    UPDATE campaigns SET status = ${status}, updated_at = now() WHERE id = ${id}
  `;
}

/**
 * Adds to a campaign's recorded spend and returns the new total. Called by the
 * worker after each billable provider call. Returning the updated row in the
 * same statement keeps the read and write atomic, so two workers incrementing
 * concurrently cannot both observe the pre-increment total.
 */
export async function addCampaignSpend(
  id: number,
  cents: number,
): Promise<number> {
  const result = await sql<{ spent_cents: number }>`
    UPDATE campaigns
    SET spent_cents = spent_cents + ${cents}, updated_at = now()
    WHERE id = ${id}
    RETURNING spent_cents
  `;
  return Number(result.rows[0]?.spent_cents ?? 0);
}

/**
 * True when a campaign has budget headroom for an estimated spend.
 * A null budget means uncapped. Checked before a job starts, never after:
 * the point is to refuse work, not to report an overspend.
 */
export async function hasBudgetFor(
  id: number,
  estimatedCents: number,
): Promise<boolean> {
  const campaign = await getCampaign(id);
  if (!campaign) return false;
  if (campaign.imageBudgetCents == null) return true;
  return campaign.spentCents + estimatedCents <= campaign.imageBudgetCents;
}

export async function listConcepts(campaignId?: number): Promise<Concept[]> {
  const result = campaignId
    ? await sql`
        SELECT * FROM concepts WHERE campaign_id = ${campaignId}
        ORDER BY created_at DESC
      `
    : await sql`SELECT * FROM concepts ORDER BY created_at DESC`;
  return result.rows.map(mapConcept);
}

export interface CreateConceptInput {
  campaignId: number | null;
  hook: string;
  angle?: string | null;
  structure?: string | null;
  format?: ContentFormat;
  sourcePostId?: number | null;
  notes?: string | null;
}

export async function createConcept(input: CreateConceptInput): Promise<Concept> {
  const result = await sql`
    INSERT INTO concepts (campaign_id, hook, angle, structure, format,
                          source_post_id, notes)
    VALUES (${input.campaignId}, ${input.hook}, ${input.angle ?? null},
            ${input.structure ?? null}, ${input.format ?? "reel"},
            ${input.sourcePostId ?? null}, ${input.notes ?? null})
    RETURNING *
  `;
  return mapConcept(result.rows[0]);
}

export async function deleteConcept(id: number): Promise<void> {
  await sql`DELETE FROM concepts WHERE id = ${id}`;
}
