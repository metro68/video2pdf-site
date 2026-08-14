import type { DerivedEconomics } from "@/lib/ads/economics";

export interface AdRowFacts {
  adId: string;
  adName: string;
  adsetName: string;
  spendGbp: number;
  impressions: number;
  clicks: number;
  ctrPct: number;
  cpcGbp: number | null;
  contentViews: number;
  emailStepViews: number;
  leads: number;
  checkouts: number;
  pixelTrials: number;
  cpaGbp: number | null;
}

export interface AccountFunnelFacts {
  clicks: number;
  emailStepViews: number;
  leads: number;
  checkouts: number;
  pixelTrials: number;
  baselineClicks: number;
  baselineEmailStepViews: number;
}

export interface RulesInput {
  ads: AdRowFacts[];
  funnel: AccountFunnelFacts;
  economics: DerivedEconomics;
  cpaSeries: Array<{ date: string; cpaGbp: number | null }>;
  /** Stripe trials in the window: the truth for web checkout completion. The
   * pixel's start_trial count is unreliable (unverified action matcher), so
   * checkout-completion rules must never use pixel trials as the numerator. */
  stripeTrials: number;
}

export type Severity = "info" | "act" | "urgent";

export interface Deduction {
  id: string;
  severity: Severity;
  title: string;
  evidence: string;
  rationale: string;
  hypothesis: string;
  adId?: string;
}

// Rule thresholds. Heuristics from the spec, tuned for low-volume accounts.
const CREATIVE_SPEND_X_CPA = 1.5;
const CREATIVE_MIN_SPEND_GBP = 15;
const CREATIVE_LOW_CTR_PCT = 1;
const HEALTHY_CTR_PCT = 1.5;
const ONBOARDING_BASELINE_FRACTION = 0.6;
const CHECKOUT_COMPLETION_FLOOR = 0.5;
const MIN_CHECKOUTS_FOR_SIGNAL = 5;
const NORMAL_SWING = 0.3;

const SEV_ORDER: Record<Severity, number> = { urgent: 0, act: 1, info: 2 };

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function runRules(input: RulesInput): Deduction[] {
  const out: Deduction[] = [];
  const { ads, funnel, economics, cpaSeries, stripeTrials } = input;

  // change-creative, per ad
  const cpaFloor = Math.max(economics.cpaGbp ?? economics.breakEvenCpaGbp, CREATIVE_MIN_SPEND_GBP / CREATIVE_SPEND_X_CPA);
  for (const ad of ads) {
    if (ad.spendGbp >= CREATIVE_SPEND_X_CPA * cpaFloor && ad.ctrPct < CREATIVE_LOW_CTR_PCT && ad.pixelTrials === 0) {
      out.push({
        id: "change-creative",
        severity: "act",
        adId: ad.adId,
        title: `Swap creative "${ad.adName}" for one in the wings`,
        evidence: `${ad.adName}${ad.adsetName ? ` (ad set: ${ad.adsetName})` : ""}: £${ad.spendGbp.toFixed(2)} spent, CTR ${ad.ctrPct.toFixed(2)}%, 0 trials.`,
        rationale: "Spend past 1.5x CPA with sub-1% CTR and no trials means the creative, not the audience, is the bottleneck.",
        hypothesis: "A replacement creative reaches at least 1.5% CTR at similar CPC within £15 of spend.",
      });
    }
  }

  // shorten-onboarding, account level
  const rate = funnel.clicks > 0 ? funnel.emailStepViews / funnel.clicks : null;
  const baseline = funnel.baselineClicks > 0 ? funnel.baselineEmailStepViews / funnel.baselineClicks : null;
  const anyHealthyCtr = ads.some((a) => a.ctrPct >= HEALTHY_CTR_PCT);
  if (rate != null && baseline != null && baseline > 0 && anyHealthyCtr && rate < ONBOARDING_BASELINE_FRACTION * baseline) {
    out.push({
      id: "shorten-onboarding",
      severity: "act",
      title: "Test a shorter onboarding flow before the email gate",
      evidence: `Click to email-step rate is ${pct(rate)} vs ${pct(baseline)} trailing-30-day baseline.`,
      rationale: "Ads are earning clicks but visitors bail in the quiz steps before the email gate, so the drop-off is in onboarding, not the ads.",
      hypothesis: "Cutting one qualify step lifts click-to-email rate back toward baseline without hurting trial quality.",
    });
  }

  // app-trial-instead-of-web, account level. Numerator is Stripe trials, the
  // source of truth for completed web checkouts; pixel checkout starts remain
  // the denominator since Stripe never sees an abandoned checkout. Mixing
  // sources slightly overstates completion when a checkout start is not
  // pixel-attributed, which is the safe direction for this rule.
  const completion = funnel.checkouts > 0 ? stripeTrials / funnel.checkouts : null;
  if (completion != null && funnel.checkouts >= MIN_CHECKOUTS_FOR_SIGNAL && completion < CHECKOUT_COMPLETION_FLOOR) {
    out.push({
      id: "app-trial-instead-of-web",
      severity: "act",
      title: "Expand routing to the app store free trial instead of web checkout",
      evidence: `${stripeTrials} Stripe trials from ${funnel.checkouts} pixel checkout starts (${pct(completion)} completion).`,
      rationale: "Leads reach checkout but stall at payment entry; a store trial removes card entry friction at the cost of the store fee.",
      hypothesis: "Store-trial routing converts over half of checkout starters, net of the store fee.",
    });
  }

  // economics-branch, mirrors the verdict with the agreed action
  if (economics.verdict === "broken") {
    out.push({
      id: "economics-branch",
      severity: "urgent",
      title: "Stop spend: trial-to-paid is broken",
      evidence: `CPA ${economics.cpaGbp != null ? `£${economics.cpaGbp.toFixed(2)}` : "n/a"} vs break-even £${economics.breakEvenCpaGbp.toFixed(2)}, observed trial-to-paid ${economics.observedTrialToPaid != null ? pct(economics.observedTrialToPaid) : "n/a"}.`,
      rationale: "With a decided cohort converting this poorly, more spend buys trials that do not pay; the funnel needs fixing before the bidding does.",
      hypothesis: "Pausing spend and fixing the biggest funnel drop-off restores trial-to-paid above 40% on the next cohort.",
    });
  } else if (economics.verdict === "working") {
    out.push({
      id: "economics-branch",
      severity: "info",
      title: "Hold the current budget: economics are on plan",
      evidence: `CPA ${economics.cpaGbp != null ? `£${economics.cpaGbp.toFixed(2)}` : "n/a"} at or under break-even £${economics.breakEvenCpaGbp.toFixed(2)}.`,
      rationale: "Cohort economics clear break-even at the current trial-to-paid rate, so the plan is to let delivery stabilize, not to tinker.",
      hypothesis: "Holding budget flat keeps CPA within 20% of today through the next cohort.",
    });
  } else {
    out.push({
      id: "economics-branch",
      severity: "act",
      title: "Stretch the budget for a definitive read",
      evidence: `CPA ${economics.cpaGbp != null ? `£${economics.cpaGbp.toFixed(2)}` : "n/a"} vs break-even £${economics.breakEvenCpaGbp.toFixed(2)}; economics are not clearly working or broken.`,
      rationale: "Payers exist but the numbers straddle break-even; a lower daily budget extends the runway until the cohort gives a clear answer.",
      hypothesis: "Another 15 decided trials resolves the verdict to working or broken.",
    });
  }

  // normal-fluctuation-guard
  const swings: number[] = [];
  for (let i = 1; i < cpaSeries.length; i++) {
    const prev = cpaSeries[i - 1].cpaGbp;
    const cur = cpaSeries[i].cpaGbp;
    if (prev != null && cur != null && prev > 0) swings.push(Math.abs(cur - prev) / prev);
  }
  if (swings.length > 0 && swings.every((s) => s < NORMAL_SWING)) {
    out.push({
      id: "normal-fluctuation-guard",
      severity: "info",
      title: "No action needed on daily CPA swings",
      evidence: `Largest day-over-day CPA swing in the window: ${pct(Math.max(...swings))}.`,
      rationale: "Day-over-day movement under 30% is normal delivery variance, not a trend; reacting to it resets learning for nothing.",
      hypothesis: "Ignoring sub-30% daily swings leaves weekly CPA unchanged versus intervening.",
    });
  }

  return out.sort((x, y) => SEV_ORDER[x.severity] - SEV_ORDER[y.severity]);
}
