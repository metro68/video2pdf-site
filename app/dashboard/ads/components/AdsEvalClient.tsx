"use client";

import { useEffect, useState } from "react";
import type { AdsEvalPayload } from "@/lib/ads/assemble";
import { deriveEconomics, isModeling } from "@/lib/ads/economics";
import type { AdsAssumptions } from "@/lib/ads/config";
import KpiTile from "@/app/dashboard/components/KpiTile";
import DashboardTabs from "@/app/dashboard/components/DashboardTabs";
import VerdictBanner from "./VerdictBanner";
import AssumptionsPanel from "./AssumptionsPanel";
import CohortChart from "./CohortChart";
import AdTable from "./AdTable";
import DeductionsPanel from "./DeductionsPanel";

const DAY_OPTIONS = [7, 14, 30] as const;

function fmtGbp(n: number): string {
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}£${Math.abs(n).toFixed(2)}`;
}

// Mirrors FreshnessLine's canonical "not connected" phrasing so the same
// underlying state reads the same way across the dashboard.
function humanError(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw === "awaiting_credentials") return "not connected";
  return raw;
}

export default function AdsEvalClient() {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(14);
  const [payload, setPayload] = useState<AdsEvalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [assumptions, setAssumptions] = useState<AdsAssumptions | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(false);
    fetch(`/api/ads-eval?days=${days}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
        return r.json() as Promise<AdsEvalPayload>;
      })
      .then((res) => {
        if (cancelled) return;
        setPayload(res);
        setAssumptions(res.assumptions);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, retryTick]);

  if (fetchError) {
    return (
      <main className="min-h-screen bg-brand-bg text-brand-text p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <DashboardTabs isAdmin={true} />
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            <p className="text-sm text-red-500">
              Could not load ads data. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => setRetryTick((t) => t + 1)}
              className="mt-3 rounded-lg border border-brand-border px-3 py-1.5 text-sm text-brand-text hover:bg-brand-bg-card"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (loading || !payload || !assumptions) {
    return (
      <main className="min-h-screen bg-brand-bg text-brand-text p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <DashboardTabs isAdmin={true} />
          <p className="text-sm text-brand-text-secondary">Loading ads eval&hellip;</p>
        </div>
      </main>
    );
  }

  const overrideCancelRate = assumptions.assumedTrialCancelRate !== payload.assumptions.assumedTrialCancelRate;
  const economics = deriveEconomics(payload.facts, assumptions, { overrideCancelRate });
  const modeling = isModeling(assumptions, payload.assumptions);
  // AssumptionsPanel labels this input "cancel rate", so the helper text next
  // to it must report the observed CANCEL rate, not the observed PAID
  // (trial-to-paid) rate; economics only carries the paid rate, so invert it
  // here, null-safe.
  const observedCancelRate = economics.observedTrialToPaid != null ? 1 - economics.observedTrialToPaid : null;
  const observedN = payload.facts.cohort.decided;
  const metaErrorMsg = humanError(payload.errors.meta);
  const stripeErrorMsg = humanError(payload.errors.stripe);
  const trialToPaidBadge =
    economics.trialToPaidSource === "observed"
      ? `observed (n=${observedN})`
      : modeling
        ? "MODELING"
        : "assumed";

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/assets/icon.png" alt="Video2PDF" className="h-10 w-10 rounded-lg" />
            <div>
              <h1 className="text-xl font-bold text-brand-primary">Video2PDF Analytics</h1>
              <p className="text-xs text-brand-text-secondary">
                Is Meta ad spend paying for itself, based on Stripe&apos;s actual trial and payment
                records.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-brand-border bg-brand-bg-card p-1">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                aria-pressed={days === d}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  days === d
                    ? "bg-brand-primary text-white"
                    : "text-brand-text-secondary hover:bg-brand-bg hover:text-brand-text"
                }`}
              >
                Last {d} days
              </button>
            ))}
          </div>
        </header>

        <DashboardTabs isAdmin={true} />

        <VerdictBanner
          economics={economics}
          cohort={payload.facts.cohort}
          modeling={modeling}
          assumptions={assumptions}
          facts={payload.facts}
        />

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            label="Spend"
            value={`£${payload.facts.spendGbp.toFixed(2)}`}
            description={`Total Meta spend across all ads in this ${payload.windowDays}-day window (${payload.from} to ${payload.to}). From Meta's reporting API; can lag a few hours.`}
          />
          <KpiTile
            label="Trial starts"
            value={payload.facts.cohort.trials.toLocaleString()}
            description="Stripe subscriptions with a trial_start in this window. Stripe is live; this includes every trial regardless of whether it has been decided yet."
          />
          <KpiTile
            label="CPA"
            value={economics.cpaGbp != null ? `£${economics.cpaGbp.toFixed(2)}` : "n/a"}
            description="Spend divided by Stripe trials started in this window. n/a when no trials started yet."
          />
          <KpiTile
            label="Decided trials"
            value={payload.facts.cohort.decided.toLocaleString()}
            description="Trials that have either converted to paid or canceled. A trial is decided once it is past the 3-day trial window, or it canceled earlier. Stripe is live."
          />
          <KpiTile
            label="Trial to paid"
            value={`${Math.round(economics.trialToPaid * 100)}%`}
            description="Below 15 decided trials this shows the assumed rate, not data. A decided trial has either converted to paid or canceled; pending trials are excluded from this rate."
            freshness={trialToPaidBadge}
          />
          <KpiTile
            label="Payers"
            value={payload.facts.cohort.payers.toLocaleString()}
            description="Decided trials that converted to a paid subscription. Stripe is live."
          />
          <KpiTile
            label="Revenue collected"
            value={`$${payload.facts.cohort.collectedUsd.toFixed(2)}`}
            description="Actual amount Stripe has taken so far for this cohort, after Stripe fees but before any later refunds. Stripe is live; USD, not converted."
          />
          <KpiTile
            label="Break-even CPA"
            value={`£${economics.breakEvenCpaGbp.toFixed(2)}`}
            description="The most a trial can cost in ad spend and still be profitable, given the current price, trial-to-paid rate, Stripe fee, and refund rate assumptions."
            freshness={modeling ? "MODELING" : undefined}
          />
          <KpiTile
            label="Projected P&amp;L"
            value={fmtGbp(economics.projectedPnlGbp)}
            description="Expected revenue from this cohort (paid trials plus pending trials weighted by trial-to-paid) converted to GBP, minus spend in this window. A projection, not booked cash."
            freshness={modeling ? "MODELING" : undefined}
          />
        </section>

        <AssumptionsPanel
          value={assumptions}
          defaults={payload.assumptions}
          observedCancelRate={observedCancelRate}
          observedN={observedN}
          onChange={setAssumptions}
        />

        <CohortChart
          daily={payload.daily}
          economics={economics}
          gbpPerUsd={assumptions.gbpPerUsd}
          modeling={modeling}
        />

        {metaErrorMsg ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-500">
            Meta reporting unavailable: {metaErrorMsg}. Economics below still reflect Stripe.
          </div>
        ) : (
          <AdTable ads={payload.ads} deductions={payload.deductions} breakEvenCpaGbp={economics.breakEvenCpaGbp} />
        )}

        {stripeErrorMsg ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-500">
            Stripe reporting unavailable: {stripeErrorMsg}. Economics above still reflect Meta spend
            only and cannot show a real trial-to-paid rate.
          </div>
        ) : null}

        <DeductionsPanel deductions={payload.deductions} modeling={modeling} />

        <div className="rounded-xl border border-brand-border bg-brand-bg-card p-4 text-xs text-brand-text-secondary">
          <div>
            as of {payload.asOf ? new Date(payload.asOf).toLocaleString() : "unknown"} &middot; Meta{" "}
            {metaErrorMsg ? `error: ${metaErrorMsg}` : "up to date"} &middot; Stripe{" "}
            {stripeErrorMsg ? `error: ${stripeErrorMsg}` : "up to date"}
          </div>
        </div>
      </div>
    </main>
  );
}
