"use client";

import { useCallback, useEffect, useState } from "react";
import type { TrendsPayload } from "@/lib/content/trends";
import AddAccountForm from "./AddAccountForm";
import RecordReadingForm from "./RecordReadingForm";

interface TrendsResponse {
  status: "ok" | "error";
  asOf: string | null;
  data: TrendsPayload | null;
  error?: string;
}

function pct(v: number | null): string {
  return v == null ? "n/a" : `${(v * 100).toFixed(1)}%`;
}

function ratio(v: number | null): string {
  return v == null ? "n/a" : `${v.toFixed(2)}x`;
}

function count(v: number | null): string {
  return v == null ? "n/a" : v.toLocaleString();
}

function ago(ts: number | null): string {
  if (ts == null) return "never";
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default function TrendsView() {
  const [payload, setPayload] = useState<TrendsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bumped by every action that changes the underlying data. The reset-then-fetch
  // shape inside the effect matches DashboardClient and AdsEvalClient; the
  // set-state-in-effect rule is a warning repo-wide for exactly this pattern.
  const [reloadTick, setReloadTick] = useState(0);
  const load = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/content/trends")
      .then((r) => r.json() as Promise<TrendsResponse>)
      .then((res) => {
        if (cancelled) return;
        if (res.status === "ok" && res.data) setPayload(res.data);
        else setError(res.error ?? "Could not load trends.");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load trends.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  if (loading && !payload) {
    return <p className="text-sm text-brand-text-secondary">Loading trends&hellip;</p>;
  }

  if (error && !payload) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
        <p className="text-sm text-red-500">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-lg border border-brand-border px-3 py-1.5 text-sm hover:bg-brand-bg-card"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!payload) return null;

  const { collector, watchlist, ranked, windowDays } = payload;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-border bg-brand-bg-card p-4">
        <p className="text-sm text-brand-text-secondary">
          <span className="font-medium text-brand-text">Where these figures come from: </span>
          {collector.label}. Instagram and TikTok only expose insights for accounts
          you own, so public figures for accounts you do not own are whatever is
          visible on the post, recorded by hand. Nothing here is Insights data, and
          reach, saves and retention are not available for watched accounts.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Watchlist</h2>
          <AddAccountForm onAdded={load} />
        </div>

        {watchlist.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-brand-bg-card p-6">
            <p className="text-sm text-brand-text-secondary">
              No accounts yet. Add the accounts you own and the public accounts worth
              watching, then record what they are posting.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-brand-bg-card text-left text-brand-text-secondary">
                <tr>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Followers</th>
                  <th className="px-4 py-2 text-right font-medium">Posts/day</th>
                  <th className="px-4 py-2 text-right font-medium">Tracked</th>
                  <th className="px-4 py-2 font-medium">Profile read</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {watchlist.map((w) => (
                  <tr key={w.account.id} className="border-t border-brand-border">
                    <td className="px-4 py-2">
                      <span className="font-medium">@{w.account.handle}</span>
                      <span className="ml-2 text-xs text-brand-text-secondary">
                        {w.account.platform === "instagram" ? "Instagram" : "TikTok"}
                      </span>
                      {w.account.angle ? (
                        <div className="text-xs text-brand-text-secondary">{w.account.angle}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-brand-text-secondary">
                      {w.account.kind === "owned" ? "Owned" : "Watched"}
                    </td>
                    <td className="px-4 py-2 text-right">{count(w.followers)}</td>
                    <td className="px-4 py-2 text-right">
                      {w.velocity == null ? "n/a" : w.velocity.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right">{w.postsTracked}</td>
                    <td className="px-4 py-2 text-brand-text-secondary">
                      {ago(w.profileCollectedAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <RecordReadingForm account={w.account} onRecorded={load} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Outliers, last {windowDays} days
        </h2>
        <p className="text-sm text-brand-text-secondary">
          Ranked by how far each post beat its own account&apos;s median, so a small
          account&apos;s breakout outranks a large account&apos;s routine post. Posts
          without enough history to score are listed last, newest first.
        </p>

        {ranked.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-brand-bg-card p-6">
            <p className="text-sm text-brand-text-secondary">
              No posts recorded yet. Use &ldquo;Record&rdquo; on a watchlist row to add
              what a post did. Three or more posts per account are needed before a
              baseline, and so an outlier score, can be computed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-brand-bg-card text-left text-brand-text-secondary">
                <tr>
                  <th className="px-4 py-2 font-medium">Post</th>
                  <th className="px-4 py-2 text-right font-medium">Outlier</th>
                  <th className="px-4 py-2 text-right font-medium">Views</th>
                  <th className="px-4 py-2 text-right font-medium">Views/follower</th>
                  <th className="px-4 py-2 text-right font-medium">Engagement</th>
                  <th className="px-4 py-2 font-medium">Basis</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => (
                  <tr key={r.post.id} className="border-t border-brand-border">
                    <td className="max-w-md px-4 py-2">
                      {r.post.postUrl ? (
                        <a
                          href={r.post.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-primary hover:underline"
                        >
                          {r.post.caption?.slice(0, 70) || r.post.platformPostId}
                        </a>
                      ) : (
                        <span>{r.post.caption?.slice(0, 70) || r.post.platformPostId}</span>
                      )}
                      <div className="text-xs text-brand-text-secondary">
                        {r.post.mediaType ?? "unknown"} &middot; {ago(r.post.publishedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {ratio(r.outlierScore)}
                    </td>
                    <td className="px-4 py-2 text-right">{count(r.post.views)}</td>
                    <td className="px-4 py-2 text-right">{ratio(r.viewToFollower)}</td>
                    <td className="px-4 py-2 text-right">{pct(r.engagementRate)}</td>
                    <td className="px-4 py-2 text-xs text-brand-text-secondary">
                      {r.baselineBasis
                        ? `${r.baselineBasis}, n=${r.baselineSampleSize}`
                        : "no baseline"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
