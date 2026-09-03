"use client";

import { useEffect, useState } from "react";
import type { QualityCheck } from "@/lib/content/types";

interface ReviewRow {
  id: number;
  conceptId: number;
  accountId: number | null;
  script: string | null;
  caption: string | null;
  hashtags: string | null;
  renderKey: string | null;
  assetKeys: string[];
  status: string;
  rejectReason: string | null;
  qualityChecks: QualityCheck[];
  approvedBy: string | null;
  updatedAt: number;
  hook: string;
  format: string;
  accountHandle: string | null;
  accountPlatform: string | null;
}

interface ReviewResponse {
  status: "ok" | "error";
  data: { variants: ReviewRow[] } | null;
  error?: string;
}

export default function ReviewView() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/content/review")
      .then((r) => r.json() as Promise<ReviewResponse>)
      .then((res) => {
        if (cancelled) return;
        if (res.status === "ok" && res.data) setRows(res.data.variants);
        else setError(res.error ?? "Could not load the review queue.");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the review queue.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  async function act(action: "approve" | "reject" | "regenerate", ids: number[]) {
    if (ids.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/content/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const json = (await res.json()) as {
        status: string;
        data?: { succeeded: number[]; failed: Array<{ id: number; error: string }> };
        error?: string;
      };
      if (json.status !== "ok" || !json.data) {
        setNotice(json.error ?? "Action failed.");
        return;
      }
      const { succeeded, failed } = json.data;
      // Partial success is reported as such: the items that worked are not
      // rolled back because others failed.
      setNotice(
        failed.length === 0
          ? `${succeeded.length} item(s) ${action}d.`
          : `${succeeded.length} ${action}d, ${failed.length} failed: ${failed
              .map((f) => `#${f.id} ${f.error}`)
              .join("; ")}`,
      );
      setSelected(new Set());
      setReloadTick((t) => t + 1);
    } catch {
      setNotice("Action failed.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading && rows.length === 0) {
    return <p className="text-sm text-brand-text-secondary">Loading review queue&hellip;</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-border bg-brand-bg-card p-4">
        <p className="text-sm text-brand-text-secondary">
          Nothing publishes without approval here. Automated checks catch overlay
          length, empty overlays, image prompts that ask for rendered text, and
          unsupportable claims. Identity drift and malformed hands are not
          automated: check those by eye.
        </p>
      </div>

      {notice ? (
        <div className="rounded-lg border border-brand-border bg-brand-bg-card p-3">
          <p className="text-sm">{notice}</p>
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-border bg-brand-bg-card p-3">
          <span className="text-sm">{selected.size} selected</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => act("approve", [...selected])}
            className="rounded-md bg-brand-primary px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act("reject", [...selected])}
            className="rounded-md border border-brand-border px-3 py-1 text-sm disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act("regenerate", [...selected])}
            className="rounded-md border border-brand-border px-3 py-1 text-sm disabled:opacity-50"
          >
            Regenerate
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-brand-border bg-brand-bg-card p-6">
          <p className="text-sm text-brand-text-secondary">
            Nothing waiting for review. Generate variants from a concept in Campaigns.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const failedChecks = row.qualityChecks.filter((c) => !c.passed);
            return (
              <li
                key={row.id}
                className="rounded-xl border border-brand-border bg-brand-bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={`Select variant ${row.id}`}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.hook}</span>
                      <span className="text-xs text-brand-text-secondary">
                        {row.format}
                        {row.accountHandle ? ` · @${row.accountHandle}` : ""}
                        {row.accountPlatform ? ` · ${row.accountPlatform}` : ""}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          row.status === "failed"
                            ? "bg-red-500/15 text-red-500"
                            : row.status === "generating"
                              ? "bg-brand-bg text-brand-text-secondary"
                              : "bg-brand-bg text-brand-text-secondary"
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>

                    {row.caption ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm">{row.caption}</p>
                    ) : null}
                    {row.hashtags ? (
                      <p className="mt-1 text-xs text-brand-text-secondary">{row.hashtags}</p>
                    ) : null}

                    <p className="mt-2 text-xs text-brand-text-secondary">
                      {row.assetKeys.length} still(s)
                      {row.renderKey ? ", rendered" : ", not yet rendered"}
                    </p>

                    {failedChecks.length > 0 ? (
                      <ul className="mt-2 space-y-0.5">
                        {failedChecks.map((c) => (
                          <li key={c.check} className="text-xs text-red-500">
                            {c.check}
                            {c.detail ? `: ${c.detail}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : row.qualityChecks.length > 0 ? (
                      <p className="mt-2 text-xs text-brand-text-secondary">
                        All automated checks passed.
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act("approve", [row.id])}
                        className="rounded-md bg-brand-primary px-3 py-1 text-xs text-white disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act("reject", [row.id])}
                        className="rounded-md border border-brand-border px-3 py-1 text-xs disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act("regenerate", [row.id])}
                        className="rounded-md border border-brand-border px-3 py-1 text-xs disabled:opacity-50"
                      >
                        Regenerate
                      </button>
                      <a
                        href={`/api/content/export?variantId=${row.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-brand-border px-3 py-1 text-xs hover:bg-brand-bg"
                      >
                        Export package
                      </a>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
