"use client";

import { useEffect, useState } from "react";
import type { AdsEvalPayload } from "@/lib/ads/assemble";
import { deriveEconomics, isModeling } from "@/lib/ads/economics";
import type { AdsAssumptions } from "@/lib/ads/config";
import KpiTile from "@/app/dashboard/components/KpiTile";
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

function humanError(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw === "awaiting_credentials") return "not configured yet";
  return raw;
}

export default function AdsEvalClient() {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(14);
  const [payload, setPayload] = useState<AdsEvalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [assumptions, setAssumptions] = useState<AdsAssumptions | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/ads-eval?days=${days}`)
      .then((r) => r.json() as Promise<AdsEvalPayload>)
      .then((res) => {
        if (cancelled) return;
        setPayload(res);
        setAssumptions(res.assumptions);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading || !payload || !assumptions) {
    return (
      <main className="min-h-screen bg-brand-bg text-brand-text p-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-brand-text-secondary">Loading ads eval&hellip;</p>
        </div>
      </main>
    );
  }

  const economics = deriveEconomics(payload.facts, assumptions);
  const modeling = isModeling(assumptions, payload.assumptions);
  const observedRate = economics.observedTrialToPaid;
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
          <div>
            <a href="/dashboard" className="text-xs text-brand-primary hover:underline">
              &larr; Back to dashboard
            </a>
            <h1 className="mt-1 text-xl font-bold text-brand-primary">Ads eval</h1>
            <p className="text-xs text-brand-text-secondary">
              Is Meta ad spend paying for itself, based on Stripe&apos;s actual trial and payment
              records.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-brand-border bg-brand-bg-card p-1">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  days === d
                    ? "bg-brand-primary text-white"
                    : "text-brand-text-secondary hover:text-brand-text"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </header>

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
            description={`Total Meta spend across all ads in this ${payload.windowDays}-day window (${payload.from} to ${payload.to}).`}
          />
          <KpiTile
            label="CPA"
            value={economics.cpaGbp != null ? `£${economics.cpaGbp.toFixed(2)}` : "n/a"}
            description="Spend divided by Stripe trials started in this window. n/a when no trials started yet."
          />
          <KpiTile
            label="Break-even CPA"
            value={`£${economics.breakEvenCpaGbp.toFixed(2)}`}
            description="The most a trial can cost in ad spend and still be profitable, given the current price, trial-to-paid rate, Stripe fee, and refund rate assumptions."
            freshness={modeling ? "MODELING" : undefined}
          />
          <KpiTile
            label="Trial to paid"
            value={`${Math.round(economics.trialToPaid * 100)}%`}
            description="Below 15 decided trials this shows the assumed rate, not data. A decided trial has either converted to paid or canceled; pending trials are excluded from this rate."
            freshness={trialToPaidBadge}
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
          observedRate={observedRate}
          observedN={observedN}
          onChange={setAssumptions}
        />

        <CohortChart daily={payload.daily} economics={economics} gbpPerUsd={assumptions.gbpPerUsd} />

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
