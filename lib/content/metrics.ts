import type { AccountSnapshot, PostSnapshot } from "@/lib/content/types";

// Derived research metrics. Every function here is pure and null-safe: a
// platform that does not publish a field leaves it null, and null is not zero.
// A metric that cannot be computed returns null rather than a misleading 0,
// so the UI can say "not available" instead of implying a real measurement.

/**
 * Engagement rate against followers, as a fraction (0.05 = 5%).
 *
 * Uses the interactions the platform actually exposes publicly. Instagram does
 * not publish shares or views for accounts we do not own, so this is likes plus
 * comments over followers, and it is directly comparable only between accounts
 * of similar size. Returns null when followers are unknown or zero.
 */
export function engagementRate(
  post: Pick<PostSnapshot, "likes" | "comments" | "shares">,
  followers: number | null | undefined,
): number | null {
  if (!followers || followers <= 0) return null;
  const likes = post.likes ?? 0;
  const comments = post.comments ?? 0;
  const shares = post.shares ?? 0;
  if (post.likes == null && post.comments == null && post.shares == null) return null;
  return (likes + comments + shares) / followers;
}

/**
 * Views divided by followers. Above 1 means the post reached beyond the
 * existing audience, which is the clearest public signal that a platform
 * pushed a post into recommendations. Null where views are not public.
 */
export function viewToFollowerRatio(
  post: Pick<PostSnapshot, "views">,
  followers: number | null | undefined,
): number | null {
  if (post.views == null) return null;
  if (!followers || followers <= 0) return null;
  return post.views / followers;
}

/**
 * Posts per day over the window the snapshots span. Needs at least two posts
 * with known publish times, since velocity is derived from the gap between
 * them rather than from a count alone.
 */
export function postingVelocity(posts: PostSnapshot[]): number | null {
  const times = posts
    .map((p) => p.publishedAt)
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b);
  if (times.length < 2) return null;
  const spanMs = times[times.length - 1] - times[0];
  if (spanMs <= 0) return null;
  const spanDays = spanMs / 86_400_000;
  // n posts across the span have n-1 intervals; dividing by intervals rather
  // than by n avoids overstating velocity for small samples.
  return (times.length - 1) / spanDays;
}

export function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * The account's own typical performance, used as the denominator for outlier
 * scoring. Median rather than mean because one viral post would otherwise drag
 * the baseline up and hide every subsequent outlier.
 *
 * Prefers views (the strongest distribution signal) and falls back to
 * interactions where views are not public, reporting which basis it used so
 * scores computed on different bases are never compared as though equivalent.
 */
export interface Baseline {
  value: number;
  basis: "views" | "interactions";
  sampleSize: number;
}

export function accountBaseline(posts: PostSnapshot[]): Baseline | null {
  const views = posts.map((p) => p.views).filter((v): v is number => v != null);
  if (views.length >= 3) {
    const m = median(views);
    if (m != null && m > 0) return { value: m, basis: "views", sampleSize: views.length };
  }
  const interactions = posts
    .map((p) =>
      p.likes == null && p.comments == null ? null : (p.likes ?? 0) + (p.comments ?? 0),
    )
    .filter((v): v is number => v != null);
  if (interactions.length >= 3) {
    const m = median(interactions);
    if (m != null && m > 0) {
      return { value: m, basis: "interactions", sampleSize: interactions.length };
    }
  }
  return null;
}

/**
 * How far a post beat its own account's median. 3 means three times baseline.
 *
 * Scoring against the account's own history rather than across accounts is
 * what makes small and large accounts comparable: a 10k-follower account's
 * 5x post is a stronger signal than a 1M-follower account's 1.2x post, and a
 * cross-account raw view count would say the opposite.
 *
 * Returns null when the post lacks the metric the baseline was built from,
 * so a views-based baseline never scores an interactions-only post.
 */
export function outlierScore(post: PostSnapshot, baseline: Baseline | null): number | null {
  if (!baseline || baseline.value <= 0) return null;
  if (baseline.basis === "views") {
    if (post.views == null) return null;
    return post.views / baseline.value;
  }
  if (post.likes == null && post.comments == null) return null;
  return ((post.likes ?? 0) + (post.comments ?? 0)) / baseline.value;
}

/** A post with everything the Trends ranking needs, metrics resolved. */
export interface RankedPost {
  post: PostSnapshot;
  engagementRate: number | null;
  viewToFollower: number | null;
  outlierScore: number | null;
  baselineBasis: Baseline["basis"] | null;
  baselineSampleSize: number;
}

/**
 * Rank recent posts across the watchlist by outlier score, so the feed surfaces
 * what beat its own account rather than whatever came from the biggest account.
 * Posts with no computable score sort last but are still returned: an unscored
 * post is missing data, not a bad post, and hiding it would silently narrow the
 * research set.
 */
export function rankPosts(
  posts: PostSnapshot[],
  historyByAccount: Map<number, PostSnapshot[]>,
  snapshotsByAccount: Map<number, AccountSnapshot>,
): RankedPost[] {
  const baselines = new Map<number, Baseline | null>();
  for (const [accountId, history] of historyByAccount) {
    baselines.set(accountId, accountBaseline(history));
  }

  const ranked: RankedPost[] = posts.map((post) => {
    const baseline = baselines.get(post.accountId) ?? null;
    const followers = snapshotsByAccount.get(post.accountId)?.followers ?? null;
    return {
      post,
      engagementRate: engagementRate(post, followers),
      viewToFollower: viewToFollowerRatio(post, followers),
      outlierScore: outlierScore(post, baseline),
      baselineBasis: baseline?.basis ?? null,
      baselineSampleSize: baseline?.sampleSize ?? 0,
    };
  });

  return ranked.sort((a, b) => {
    if (a.outlierScore == null && b.outlierScore == null) {
      return (b.post.publishedAt ?? 0) - (a.post.publishedAt ?? 0);
    }
    if (a.outlierScore == null) return 1;
    if (b.outlierScore == null) return -1;
    return b.outlierScore - a.outlierScore;
  });
}
