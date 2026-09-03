"use client";

import { useEffect, useState } from "react";
import type { ResultsPayload } from "@/lib/content/results";

interface ResultsResponse {
  status: "ok" | "error";
  data: ResultsPayload | null;
  error?: string;
}

const num = (v: number | null): string => (v == null ? "n/a" : v.toLocaleString());

export default function ResultsView() {
  const [payload, setPayload] = useState<ResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/content/results")
      .then((r) => r.json() as Promise<ResultsResponse>)
      .then((res) => {
        if (cancelled) return;
        if (res.status === "ok" && res.data) setPayload(res.data);
        else setError(res.error ?? "Could not load results.");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load results.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !payload) {
    return <p className="text-sm text-brand-text-secondary">Loading results&hellip;</p>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }
  if (!payload) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-border bg-brand-bg-card p-4">
        <p className="text-sm text-brand-text-secondary">
          <span className="font-medium text-brand-text">How these are attributed: </span>
          leads, trials and paying customers are counted against a post only when
          that post carried its own tracking link. Posts without one show
          &ldquo;account level&rdquo;, and their conversions are not guessed from
          timing. Account totals sum only the posts that carried links, so they
          understate rather than overstate.
        </p>
        {payload.unattributablePosts > 0 ? (
          <p className="mt-2 text-sm text-amber-600">
            {payload.unattributablePosts} published post(s) have no unique link, so
            their conversions cannot be separated from the rest of that
            account&apos;s traffic.
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Posts, last {payload.windowDays} days</h2>
        {payload.posts.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-brand-bg-card p-6">
            <p className="text-sm text-brand-text-secondary">
              Nothing published yet in this window.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-border">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-brand-bg-card text-left text-brand-text-secondary">
                <tr>
                  <th className="px-4 py-2 font-medium">Post</th>
                  <th className="px-4 py-2 text-right font-medium">Views</th>
                  <th className="px-4 py-2 text-right font-medium">Likes</th>
                  <th className="px-4 py-2 text-right font-medium">Comments</th>
                  <th className="px-4 py-2 text-right font-medium">Leads</th>
                  <th className="px-4 py-2 text-right font-medium">Trials</th>
                  <th className="px-4 py-2 text-right font-medium">Paying</th>
                  <th className="px-4 py-2 font-medium">Attribution</th>
                </tr>
              </thead>
              <tbody>
                {payload.posts.map((p) => (
                  <tr key={p.publicationId} className="border-t border-brand-border">
                    <td className="max-w-xs px-4 py-2">
                      <div className="truncate">{p.hook}</div>
                      <div className="text-xs text-brand-text-secondary">
                        @{p.accountHandle} · {p.accountPlatform}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">{num(p.views)}</td>
                    <td className="px-4 py-2 text-right">{num(p.likes)}</td>
                    <td className="px-4 py-2 text-right">{num(p.comments)}</td>
                    <td className="px-4 py-2 text-right">
                      {p.attribution === "post" ? p.leads : "n/a"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {p.attribution === "post" ? p.trials : "n/a"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {p.attribution === "post" ? p.paying : "n/a"}
                    </td>
                    <td className="px-4 py-2 text-xs text-brand-text-secondary">
                      {p.attribution === "post" ? "this post" : "account level"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">By account</h2>
        {payload.accounts.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-brand-bg-card p-6">
            <p className="text-sm text-brand-text-secondary">No published accounts yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-border">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-brand-bg-card text-left text-brand-text-secondary">
                <tr>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 text-right font-medium">Posts</th>
                  <th className="px-4 py-2 text-right font-medium">Leads</th>
                  <th className="px-4 py-2 text-right font-medium">Trials</th>
                  <th className="px-4 py-2 text-right font-medium">Paying</th>
                </tr>
              </thead>
              <tbody>
                {payload.accounts.map((a) => (
                  <tr
                    key={`${a.accountPlatform}-${a.accountHandle}`}
                    className="border-t border-brand-border"
                  >
                    <td className="px-4 py-2">
                      @{a.accountHandle}
                      <span className="ml-2 text-xs text-brand-text-secondary">
                        {a.accountPlatform}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{a.posts}</td>
                    <td className="px-4 py-2 text-right">{a.leads}</td>
                    <td className="px-4 py-2 text-right">{a.trials}</td>
                    <td className="px-4 py-2 text-right">{a.paying}</td>
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
