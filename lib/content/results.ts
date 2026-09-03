import { sql } from "@/lib/db/client";
import { trackingCode } from "@/lib/content/attribution";

// Results: social performance joined with the funnel data the dashboard
// already has.
//
// The honesty rule this module exists to enforce: a conversion is attributed to
// a specific post ONLY when that post carried a unique tracking link, which is
// recorded as leads.src "...|a:p<publicationId>". Everything else is reported at
// account or campaign level, and the payload says which, so the UI never
// presents a timing correlation as though it were a measured conversion.

export type AttributionLevel = "post" | "account" | "none";

export interface PostResult {
  publicationId: number;
  variantId: number;
  hook: string;
  accountHandle: string;
  accountPlatform: string;
  publishedAt: number | null;
  postUrl: string | null;

  // Social metrics, latest snapshot. Null where the platform does not report it.
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;

  // Funnel outcomes. Populated only at post level attribution.
  leads: number;
  trials: number;
  paying: number;
  attribution: AttributionLevel;
}

export interface AccountResult {
  accountHandle: string;
  accountPlatform: string;
  posts: number;
  leads: number;
  trials: number;
  paying: number;
}

export interface ResultsPayload {
  posts: PostResult[];
  accounts: AccountResult[];
  /** Posts published with no unique link, so their conversions cannot be
   *  separated from the rest of the account's traffic. */
  unattributablePosts: number;
  windowDays: number;
}

export async function buildResults(windowDays = 30): Promise<ResultsPayload> {
  // One row per publication with its latest metric snapshot. DISTINCT ON keeps
  // the newest reading rather than mixing readings from different times.
  const posts = await sql<{
    publication_id: number;
    variant_id: number;
    hook: string;
    handle: string;
    platform: string;
    published_at: Date | null;
    post_url: string | null;
    tracking_code: string | null;
    views: number | null;
    reach: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
  }>`
    SELECT DISTINCT ON (p.id)
      p.id AS publication_id, p.variant_id, c.hook,
      a.handle, a.platform, p.published_at, p.post_url, p.tracking_code,
      m.views, m.reach, m.likes, m.comments, m.shares, m.saves
    FROM publications p
    JOIN variants v ON v.id = p.variant_id
    JOIN concepts c ON c.id = v.concept_id
    JOIN social_accounts a ON a.id = p.account_id
    LEFT JOIN publication_metrics m ON m.publication_id = p.id
    WHERE p.published_at IS NOT NULL
      AND p.published_at >= now() - make_interval(days => ${windowDays})
    ORDER BY p.id, m.collected_at DESC
  `;

  // Funnel outcomes keyed by the tracking code in leads.src. The src convention
  // is "<channel>|c:<campaign>|a:<code>", so the code is matched as its own
  // segment rather than by a bare LIKE, which would also match a campaign whose
  // name happened to contain it.
  const funnel = await sql<{
    code: string;
    leads: number;
    trials: number;
    paying: number;
  }>`
    SELECT
      split_part(split_part(l.src, '|a:', 2), '|', 1) AS code,
      COUNT(DISTINCT l.email)::int AS leads,
      COUNT(DISTINCT s.email)::int AS trials,
      COUNT(DISTINCT s.email) FILTER (WHERE s.status = 'active')::int AS paying
    FROM leads l
    LEFT JOIN subscriptions s ON s.email = l.email
    WHERE l.src LIKE '%|a:p%'
    GROUP BY 1
  `;

  const byCode = new Map(funnel.rows.map((r) => [r.code, r]));

  let unattributable = 0;
  const postResults: PostResult[] = posts.rows.map((r) => {
    const code = r.tracking_code ?? trackingCode(r.publication_id);
    const outcomes = byCode.get(code);
    // A post is attributable only if it actually carried a unique link.
    const attribution: AttributionLevel = r.tracking_code ? "post" : "account";
    if (attribution !== "post") unattributable += 1;

    return {
      publicationId: Number(r.publication_id),
      variantId: Number(r.variant_id),
      hook: r.hook,
      accountHandle: r.handle,
      accountPlatform: r.platform,
      publishedAt: r.published_at ? r.published_at.getTime() : null,
      postUrl: r.post_url,
      views: r.views,
      reach: r.reach,
      likes: r.likes,
      comments: r.comments,
      shares: r.shares,
      saves: r.saves,
      leads: attribution === "post" ? Number(outcomes?.leads ?? 0) : 0,
      trials: attribution === "post" ? Number(outcomes?.trials ?? 0) : 0,
      paying: attribution === "post" ? Number(outcomes?.paying ?? 0) : 0,
      attribution,
    };
  });

  // Account level totals sum the outcomes of that account's own posts.
  //
  // They are NOT derived from the platform channel segment: several accounts
  // share a platform, so joining on channel would credit every Instagram
  // account with all Instagram traffic. Summing the account's own tracked
  // publications understates rather than overstates, which is the right way to
  // be wrong here. Posts without a unique link contribute 0 and are counted
  // separately as unattributable.
  const accountRows = await sql<{
    handle: string;
    platform: string;
    posts: number;
    leads: number;
    trials: number;
    paying: number;
  }>`
    WITH pub AS (
      SELECT a.handle, a.platform, p.tracking_code
      FROM publications p
      JOIN social_accounts a ON a.id = p.account_id
      WHERE p.published_at IS NOT NULL
        AND p.published_at >= now() - make_interval(days => ${windowDays})
    ),
    outcomes AS (
      SELECT split_part(split_part(l.src, '|a:', 2), '|', 1) AS code,
             COUNT(DISTINCT l.email)::int AS leads,
             COUNT(DISTINCT s.email)::int AS trials,
             COUNT(DISTINCT s.email) FILTER (WHERE s.status = 'active')::int AS paying
      FROM leads l
      LEFT JOIN subscriptions s ON s.email = l.email
      WHERE l.src LIKE '%|a:p%'
      GROUP BY 1
    )
    SELECT pub.handle, pub.platform,
           COUNT(*)::int AS posts,
           COALESCE(SUM(o.leads), 0)::int AS leads,
           COALESCE(SUM(o.trials), 0)::int AS trials,
           COALESCE(SUM(o.paying), 0)::int AS paying
    FROM pub
    LEFT JOIN outcomes o ON o.code = pub.tracking_code
    GROUP BY pub.handle, pub.platform
    ORDER BY posts DESC
  `;

  return {
    posts: postResults.sort((a, b) => (b.views ?? 0) - (a.views ?? 0)),
    accounts: accountRows.rows.map((r) => ({
      accountHandle: r.handle,
      accountPlatform: r.platform,
      posts: Number(r.posts),
      leads: Number(r.leads),
      trials: Number(r.trials),
      paying: Number(r.paying),
    })),
    unattributablePosts: unattributable,
    windowDays,
  };
}
