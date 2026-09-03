import { sql } from "@/lib/db/client";
import { mapPublication } from "./map";
import type { Publication, PublicationStatus } from "@/lib/content/types";
import { trackingCode } from "@/lib/content/attribution";

// Scheduled and published posts.
//
// (variant_id, account_id) is unique, so scheduling the same variant to the
// same account twice updates the existing row rather than creating a second
// publication. Combined with the platform_post_id guard in the worker, a post
// cannot be published twice by a retry.

export async function schedulePublication(
  variantId: number,
  accountId: number,
  scheduledFor: Date | null,
): Promise<Publication> {
  const result = await sql`
    INSERT INTO publications (variant_id, account_id, scheduled_for, status)
    VALUES (${variantId}, ${accountId}, ${scheduledFor}, 'scheduled')
    ON CONFLICT (variant_id, account_id) DO UPDATE SET
      scheduled_for = EXCLUDED.scheduled_for,
      status = CASE
        -- Never reopen something already published: rescheduling a published
        -- post must not queue a second copy.
        WHEN publications.status = 'published' THEN 'published'
        ELSE 'scheduled'
      END,
      updated_at = now()
    RETURNING *
  `;
  const publication = mapPublication(result.rows[0]);

  // The tracking code is derived from the publication id, so it can only be set
  // once the row exists. It is what makes post-level attribution possible.
  if (publication.trackingCode == null) {
    const code = trackingCode(publication.id);
    await sql`
      UPDATE publications SET tracking_code = ${code}, updated_at = now()
      WHERE id = ${publication.id} AND tracking_code IS NULL
    `;
    publication.trackingCode = code;
  }

  return publication;
}

export interface CalendarRow extends Publication {
  hook: string;
  caption: string | null;
  accountHandle: string;
  accountPlatform: string;
  needsReconnect: boolean;
}

export async function listCalendar(): Promise<CalendarRow[]> {
  const result = await sql`
    SELECT p.*, c.hook, v.caption,
           a.handle AS account_handle, a.platform AS account_platform,
           a.needs_reconnect
    FROM publications p
    JOIN variants v ON v.id = p.variant_id
    JOIN concepts c ON c.id = v.concept_id
    JOIN social_accounts a ON a.id = p.account_id
    ORDER BY COALESCE(p.scheduled_for, p.created_at) DESC
    LIMIT 200
  `;
  return result.rows.map((r) => ({
    ...mapPublication(r),
    hook: String(r.hook),
    caption: r.caption == null ? null : String(r.caption),
    accountHandle: String(r.account_handle),
    accountPlatform: String(r.account_platform),
    needsReconnect: Boolean(r.needs_reconnect),
  }));
}

/** Publications due to publish, for the scheduler to enqueue. Excludes accounts
 *  needing reconnection: a job against expired credentials only burns retries. */
export async function listDue(): Promise<Publication[]> {
  const result = await sql`
    SELECT p.* FROM publications p
    JOIN social_accounts a ON a.id = p.account_id
    JOIN variants v ON v.id = p.variant_id
    WHERE p.status = 'scheduled'
      AND p.scheduled_for IS NOT NULL
      AND p.scheduled_for <= now()
      AND p.platform_post_id IS NULL
      AND v.status = 'approved'
      AND a.needs_reconnect = false
      AND a.active = true
    ORDER BY p.scheduled_for
    LIMIT 50
  `;
  return result.rows.map(mapPublication);
}

export async function setPublicationStatus(
  id: number,
  status: PublicationStatus,
  detail?: { platformPostId?: string; postUrl?: string; error?: string },
): Promise<void> {
  await sql`
    UPDATE publications
    SET status = ${status},
        platform_post_id = COALESCE(${detail?.platformPostId ?? null}, platform_post_id),
        post_url = COALESCE(${detail?.postUrl ?? null}, post_url),
        published_at = CASE WHEN ${status} = 'published' THEN now() ELSE published_at END,
        last_error = ${detail?.error ?? null},
        updated_at = now()
    WHERE id = ${id}
  `;
}

export async function cancelPublication(id: number): Promise<void> {
  await sql`
    UPDATE publications SET status = 'canceled', updated_at = now()
    WHERE id = ${id} AND status IN ('scheduled','failed')
  `;
}
