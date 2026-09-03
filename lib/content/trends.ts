import { listAccounts } from "@/lib/db/content/accounts";
import {
  accountPostHistory,
  latestAccountSnapshots,
  latestPostSnapshots,
} from "@/lib/db/content/snapshots";
import { postingVelocity, rankPosts, type RankedPost } from "@/lib/content/metrics";
import { activeCollector } from "@/lib/content/collectors";
import type { PostSnapshot, SocialAccount } from "@/lib/content/types";

// Assembles the Trends payload: the watchlist with its latest profile figures
// and posting velocity, plus recent posts ranked by how far each beat its own
// account's baseline.

export interface WatchlistEntry {
  account: SocialAccount;
  followers: number | null;
  postCount: number | null;
  /** Posts per day, derived from observed publish times. */
  velocity: number | null;
  /** When this account's profile figures were last recorded. */
  profileCollectedAt: number | null;
  postsTracked: number;
}

export interface TrendsPayload {
  collector: { source: string; label: string; configured: boolean };
  watchlist: WatchlistEntry[];
  ranked: RankedPost[];
  windowDays: number;
}

export async function buildTrends(windowDays = 30): Promise<TrendsPayload> {
  const collector = activeCollector();
  const accounts = await listAccounts();
  const accountIds = accounts.map((a) => a.id);

  const [snapshots, recentPosts] = await Promise.all([
    latestAccountSnapshots(),
    latestPostSnapshots(accountIds, windowDays),
  ]);

  // History drives each account's baseline, and must not be limited to the
  // ranking window: a 30-day window on a slow-posting account would leave too
  // few posts to compute a median, and every score would come back null.
  const historyByAccount = new Map<number, PostSnapshot[]>();
  await Promise.all(
    accountIds.map(async (id) => {
      historyByAccount.set(id, await accountPostHistory(id));
    }),
  );

  const watchlist: WatchlistEntry[] = accounts.map((account) => {
    const snap = snapshots.get(account.id) ?? null;
    const history = historyByAccount.get(account.id) ?? [];
    return {
      account,
      followers: snap?.followers ?? null,
      postCount: snap?.postCount ?? null,
      velocity: postingVelocity(history),
      profileCollectedAt: snap?.collectedAt ?? null,
      postsTracked: history.length,
    };
  });

  return {
    collector: {
      source: collector.source,
      label: collector.label,
      configured: collector.isConfigured(),
    },
    watchlist,
    ranked: rankPosts(recentPosts, historyByAccount, snapshots),
    windowDays,
  };
}
