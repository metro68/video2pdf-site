"use client";

import { useState } from "react";
import type { AdsAssumptions } from "@/lib/ads/config";
import { isModeling } from "@/lib/ads/economics";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default function AssumptionsPanel({
  value,
  defaults,
  observedRate,
  observedN,
  onChange,
}: {
  value: AdsAssumptions;
  defaults: AdsAssumptions;
  observedRate: number | null;
  observedN: number;
  onChange: (a: AdsAssumptions) => void;
}) {
  const [editing, setEditing] = useState(false);
  const modeling = isModeling(value, defaults);

  function set<K extends keyof AdsAssumptions>(key: K, next: AdsAssumptions[K]) {
    onChange({ ...value, [key]: next });
  }

  function num(raw: string): number {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  return (
    <div className="rounded-xl border border-brand-border bg-brand-bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-brand-text">Assumptions</div>
          {modeling ? (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-500">
              MODELING
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              onChange(defaults);
              setEditing(false);
            }}
            className="text-sm text-brand-text-secondary underline"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="text-sm text-brand-primary hover:underline"
          >
            {editing ? "Done" : "Edit assumptions"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-brand-text-secondary">
          Price (USD, annual)
          <input
            type="number"
            aria-label="Price (USD, annual)"
            disabled={!editing}
            value={value.annualPriceUsd}
            onChange={(e) => set("annualPriceUsd", num(e.target.value))}
            className="rounded-lg border border-brand-border bg-brand-bg px-2 py-1.5 text-sm text-brand-text disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-brand-text-secondary">
          Cancel rate (%)
          <input
            type="number"
            aria-label="Cancel rate (%)"
            disabled={!editing}
            value={Math.round(value.assumedTrialCancelRate * 100)}
            onChange={(e) => set("assumedTrialCancelRate", num(e.target.value) / 100)}
            className="rounded-lg border border-brand-border bg-brand-bg px-2 py-1.5 text-sm text-brand-text disabled:opacity-60"
          />
          {observedRate != null ? (
            <span className="text-brand-text-secondary">
              observed cancel rate: {pct(observedRate)} (n={observedN})
            </span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-xs text-brand-text-secondary">
          Refund rate (%)
          <input
            type="number"
            aria-label="Refund rate (%)"
            disabled={!editing}
            value={Math.round(value.refundRate * 100)}
            onChange={(e) => set("refundRate", num(e.target.value) / 100)}
            className="rounded-lg border border-brand-border bg-brand-bg px-2 py-1.5 text-sm text-brand-text disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-brand-text-secondary">
          Stripe fee (%)
          <input
            type="number"
            aria-label="Stripe fee (%)"
            disabled={!editing}
            value={Math.round(value.stripeFeeRate * 100)}
            onChange={(e) => set("stripeFeeRate", num(e.target.value) / 100)}
            className="rounded-lg border border-brand-border bg-brand-bg px-2 py-1.5 text-sm text-brand-text disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-brand-text-secondary">
          GBP per USD
          <input
            type="number"
            aria-label="GBP per USD"
            disabled={!editing}
            step="0.01"
            value={value.gbpPerUsd}
            onChange={(e) => set("gbpPerUsd", num(e.target.value))}
            className="rounded-lg border border-brand-border bg-brand-bg px-2 py-1.5 text-sm text-brand-text disabled:opacity-60"
          />
        </label>
      </div>

      <p className="mt-4 text-xs leading-snug text-brand-text-secondary">
        Change these to model outcomes. Edits are not saved and do not affect any real data; they
        only recompute the verdict, break-even, KPI tiles, and chart below in your browser.
        Reloading the page resets everything to the server&apos;s defaults.
      </p>
    </div>
  );
}
