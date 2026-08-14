import type { AdDailyRow } from "@/lib/connectors/meta";
import type { TrialCohort } from "@/lib/connectors/stripe";
import { ADS_ASSUMPTIONS, type AdsAssumptions } from "@/lib/ads/config";
import { deriveEconomics, type AdsFacts, type CohortAggregates } from "@/lib/ads/economics";
import { runRules, type AdRowFacts, type AccountFunnelFacts, type Deduction } from "@/lib/ads/rules";

export interface AdsEvalPayload {
  status: "ok" | "partial" | "error";
  asOf: string | null;
  windowDays: number;
  from: string;
  to: string;
  ads: AdRowFacts[];
  funnel: AccountFunnelFacts;
  facts: AdsFacts;
  daily: Array<{ date: string; spendGbp: number; stripeTrials: number; collectedUsd: number }>;
  deductions: Deduction[];
  assumptions: AdsAssumptions;
  errors: { meta?: string; stripe?: string };
}

const EMPTY_AGG: CohortAggregates = {
  trials: 0, decided: 0, payers: 0, canceled: 0, pastDue: 0, pending: 0, collectedUsd: 0,
};

function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function assemblePayload(args: {
  adRows: AdDailyRow[] | null;
  cohort: TrialCohort | null;
  windowDays: number;
  now: Date;
  metaError?: string;
  stripeError?: string;
}): AdsEvalPayload {
  const { adRows, cohort, windowDays, now, metaError, stripeError } = args;
  const to = day(now);
  const from = day(new Date(now.getTime() - (windowDays - 1) * 864e5));

  const allRows = adRows ?? [];
  const windowRows = allRows.filter((r) => r.date >= from && r.date <= to);

  const byAd = new Map<string, AdRowFacts>();
  for (const r of windowRows) {
    const acc = byAd.get(r.adId) ?? {
      adId: r.adId, adName: r.adName, adsetName: r.adsetName, spendGbp: 0, impressions: 0, clicks: 0,
      ctrPct: 0, cpcGbp: null, contentViews: 0, emailStepViews: 0, leads: 0,
      checkouts: 0, pixelTrials: 0, cpaGbp: null,
    };
    acc.adName = r.adName || acc.adName;
    acc.adsetName = r.adsetName || acc.adsetName;
    acc.spendGbp += r.spend;
    acc.impressions += r.impressions;
    acc.clicks += r.clicks;
    acc.contentViews += r.contentViews;
    acc.emailStepViews += r.emailStepViews;
    acc.leads += r.leads;
    acc.checkouts += r.checkouts;
    acc.pixelTrials += r.trials;
    byAd.set(r.adId, acc);
  }
  const ads = [...byAd.values()].map((a) => ({
    ...a,
    ctrPct: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
    cpcGbp: a.clicks > 0 ? a.spendGbp / a.clicks : null,
    cpaGbp: a.pixelTrials > 0 ? a.spendGbp / a.pixelTrials : null,
  })).sort((x, y) => y.spendGbp - x.spendGbp);

  const sum = (rows: AdDailyRow[], k: keyof AdDailyRow) =>
    rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const funnel: AccountFunnelFacts = {
    clicks: sum(windowRows, "clicks"),
    emailStepViews: sum(windowRows, "emailStepViews"),
    leads: sum(windowRows, "leads"),
    checkouts: sum(windowRows, "checkouts"),
    pixelTrials: sum(windowRows, "trials"),
    baselineClicks: sum(allRows, "clicks"),
    baselineEmailStepViews: sum(allRows, "emailStepViews"),
  };

  const aggregates = cohort?.aggregates ?? EMPTY_AGG;
  const last7From = day(new Date(now.getTime() - 6 * 864e5));
  const trialsLast7 = (cohort?.dailyTrials ?? [])
    .filter((d) => d.date >= last7From && d.date <= to)
    .reduce((s, d) => s + d.count, 0);
  const facts: AdsFacts = {
    spendGbp: sum(windowRows, "spend"),
    stripeTrials: aggregates.trials,
    trialsLast7,
    cohort: aggregates,
  };

  const spendByDate = new Map<string, number>();
  for (const r of windowRows) spendByDate.set(r.date, (spendByDate.get(r.date) ?? 0) + r.spend);
  const trialsByDate = new Map((cohort?.dailyTrials ?? []).map((d) => [d.date, d.count]));
  const dates: string[] = [];
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= new Date(`${to}T00:00:00Z`).getTime(); t += 864e5) {
    dates.push(day(new Date(t)));
  }
  // collectedUsd is a cohort total, not a per-day series; it rides on the last
  // date so the chart's final point reflects reality without inventing history.
  const daily = dates.map((date, i) => ({
    date,
    spendGbp: spendByDate.get(date) ?? 0,
    stripeTrials: trialsByDate.get(date) ?? 0,
    collectedUsd: i === dates.length - 1 ? aggregates.collectedUsd : 0,
  }));

  const economics = deriveEconomics(facts, ADS_ASSUMPTIONS);
  const cpaSeries = dates.map((date) => {
    const spend = spendByDate.get(date) ?? 0;
    const trials = trialsByDate.get(date) ?? 0;
    return { date, cpaGbp: trials > 0 ? spend / trials : null };
  });
  const deductions = runRules({ ads, funnel, economics, cpaSeries });

  const status: AdsEvalPayload["status"] =
    adRows && cohort ? "ok" : !adRows && !cohort ? "error" : "partial";

  return {
    status,
    asOf: new Date().toISOString(),
    windowDays,
    from,
    to,
    ads,
    funnel,
    facts,
    daily,
    deductions,
    assumptions: ADS_ASSUMPTIONS,
    errors: {
      ...(metaError ? { meta: metaError } : {}),
      ...(stripeError ? { stripe: stripeError } : {}),
    },
  };
}
