import { sql } from "@/lib/db/client";
import { mapAccountSnapshot, mapPostSnapshot } from "./map";
import type {
  AccountSnapshot,
  MediaType,
  MetricSource,
  PostSnapshot,
} from "@/lib/content/types";

// Profile and post snapshots for the research watchlist.
//
// Both tables are append-only: a new reading never overwrites an old one, so
// follower growth and posting velocity are derivable and a stale figure stays
// visibly stale. Reads take the latest row per subject.

export interface RecordAccountSnapshotInput {
  accountId: number;
  followers?: number | null;
  following?: number | null;
  postCount?: number | null;
  source: MetricSource;
}

export async function recordAccountSnapshot(
  input: RecordAccountSnapshotInput,
): Promise<AccountSnapshot> {
  const result = await sql`
    INSERT INTO account_snapshots (account_id, followers, following, post_count, source)
    VALUES (${input.accountId}, ${input.followers ?? null},
            ${input.following ?? null}, ${input.postCount ?? null}, ${input.source})
    RETURNING *
  `;
  return mapAccountSnapshot(result.rows[0]);
}

/** Most recent profile reading for one account, or null if never collected. */
export async function latestAccountSnapshot(
  accountId: number,
): Promise<AccountSnapshot | null> {
  const result = await sql`
    SELECT * FROM account_snapshots
    WHERE account_id = ${accountId}
    ORDER BY collected_at DESC
    LIMIT 1
  `;
  const row = result.rows[0];
  return row ? mapAccountSnapshot(row) : null;
}

/** Latest reading for every account, in one query rather than N. */
export async function latestAccountSnapshots(): Promise<Map<number, AccountSnapshot>> {
  const result = await sql`
    SELECT DISTINCT ON (account_id) *
    FROM account_snapshots
    ORDER BY account_id, collected_at DESC
  `;
  const out = new Map<number, AccountSnapshot>();
  for (const row of result.rows) {
    const snap = mapAccountSnapshot(row);
    out.set(snap.accountId, snap);
  }
  return out;
}

export interface RecordPostSnapshotInput {
  accountId: number;
  platformPostId: string;
  postUrl?: string | null;
  caption?: string | null;
  mediaType?: MediaType | null;
  publishedAt?: Date | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  source: MetricSource;
}

export async function recordPostSnapshot(
  input: RecordPostSnapshotInput,
): Promise<PostSnapshot> {
  const result = await sql`
    INSERT INTO post_snapshots (
      account_id, platform_post_id, post_url, caption, media_type,
      published_at, views, likes, comments, shares, source
    )
    VALUES (
      ${input.accountId}, ${input.platformPostId}, ${input.postUrl ?? null},
      ${input.caption ?? null}, ${input.mediaType ?? null},
      ${input.publishedAt ?? null}, ${input.views ?? null}, ${input.likes ?? null},
      ${input.comments ?? null}, ${input.shares ?? null}, ${input.source}
    )
    RETURNING *
  `;
  return mapPostSnapshot(result.rows[0]);
}

/**
 * Latest reading for each distinct post belonging to the given accounts,
 * published within `sinceDays`. This is the input to the Trends ranking: one
 * row per post, newest metrics, so engagement and outlier scores are computed
 * against current numbers rather than a mix of readings.
 */
export async function latestPostSnapshots(
  accountIds: number[],
  sinceDays = 30,
): Promise<PostSnapshot[]> {
  if (accountIds.length === 0) return [];
  const result = await sql`
    SELECT DISTINCT ON (account_id, platform_post_id) *
    FROM post_snapshots
    WHERE account_id = ANY(${accountIds}::bigint[])
      AND (published_at IS NULL OR published_at >= now() - make_interval(days => ${sinceDays}))
    ORDER BY account_id, platform_post_id, collected_at DESC
  `;
  return result.rows.map(mapPostSnapshot);
}

/** Every latest-reading post for one account, for baseline calculation. */
export async function accountPostHistory(
  accountId: number,
  limit = 50,
): Promise<PostSnapshot[]> {
  const result = await sql`
    SELECT DISTINCT ON (platform_post_id) *
    FROM post_snapshots
    WHERE account_id = ${accountId}
    ORDER BY platform_post_id, collected_at DESC
    LIMIT ${limit}
  `;
  return result.rows.map(mapPostSnapshot);
}
