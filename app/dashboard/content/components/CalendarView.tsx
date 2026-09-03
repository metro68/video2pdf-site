"use client";

import { useEffect, useState } from "react";

interface CalendarRow {
  id: number;
  variantId: number;
  accountId: number;
  scheduledFor: number | null;
  publishedAt: number | null;
  platformPostId: string | null;
  postUrl: string | null;
  trackingCode: string | null;
  status: string;
  attempts: number;
  lastError: string | null;
  hook: string;
  caption: string | null;
  accountHandle: string;
  accountPlatform: string;
  needsReconnect: boolean;
}

interface CalendarResponse {
  status: "ok" | "error";
  data: { publications: CalendarRow[] } | null;
  error?: string;
}

function when(ts: number | null): string {
  if (ts == null) return "unscheduled";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CalendarView() {
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/content/calendar")
      .then((r) => r.json() as Promise<CalendarResponse>)
      .then((res) => {
        if (cancelled) return;
        if (res.status === "ok" && res.data) setRows(res.data.publications);
        else setError(res.error ?? "Could not load the calendar.");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the calendar.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  async function cancel(id: number) {
    await fetch(`/api/content/calendar?id=${id}`, { method: "DELETE" });
    setReloadTick((t) => t + 1);
  }

  if (loading && rows.length === 0) {
    return <p className="text-sm text-brand-text-secondary">Loading calendar&hellip;</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  const reconnectNeeded = rows.filter((r) => r.needsReconnect);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-border bg-brand-bg-card p-4">
        <p className="text-sm text-brand-text-secondary">
          Approved variants scheduled to accounts. A scheduled post becomes a job
          for the worker; a post that already has a platform id is never sent
          again, so a retry cannot publish a duplicate. Until platform approval
          lands, use &ldquo;Export package&rdquo; in Review and publish by hand.
        </p>
      </div>

      {reconnectNeeded.length > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-600">
            {reconnectNeeded.length} scheduled post(s) are on accounts needing
            reconnection. These are skipped rather than retried until the account
            is reconnected.
          </p>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-brand-border bg-brand-bg-card p-6">
          <p className="text-sm text-brand-text-secondary">
            Nothing scheduled. Approve a variant in Review, then schedule it here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-brand-bg-card text-left text-brand-text-secondary">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Account</th>
                <th className="px-4 py-2 font-medium">Post</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Tracking</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-brand-border">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {when(r.publishedAt ?? r.scheduledFor)}
                  </td>
                  <td className="px-4 py-2">
                    @{r.accountHandle}
                    <div className="text-xs text-brand-text-secondary">
                      {r.accountPlatform}
                      {r.needsReconnect ? " · reconnect needed" : ""}
                    </div>
                  </td>
                  <td className="max-w-sm px-4 py-2">
                    <div className="truncate">{r.hook}</div>
                    {r.lastError ? (
                      <div className="text-xs text-red-500">{r.lastError}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-brand-text-secondary">{r.status}</span>
                    {r.attempts > 0 ? (
                      <span className="ml-1 text-xs text-brand-text-secondary">
                        ({r.attempts} attempt{r.attempts === 1 ? "" : "s"})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs text-brand-text-secondary">
                    {r.trackingCode ?? "none"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.status === "scheduled" || r.status === "failed" ? (
                      <button
                        type="button"
                        onClick={() => cancel(r.id)}
                        className="rounded-md border border-brand-border px-2 py-1 text-xs hover:bg-brand-bg-card"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
