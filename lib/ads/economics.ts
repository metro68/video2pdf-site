import type { AdsAssumptions } from "@/lib/ads/config";
import { LEARNING_PHASE_WEEKLY_TRIALS } from "@/lib/ads/config";

export interface CohortAggregates {
  trials: number;
  decided: number;
  payers: number;
  canceled: number;
  pastDue: number;
  pending: number;
  collectedUsd: number;
}

export interface AdsFacts {
  spendGbp: number;
  stripeTrials: number;
  /** Ad-attributed app-store trial starts (AppsFlyer af_start_trial) in the window. */
  appTrials: number;
  trialsLast7: number;
  cohort: CohortAggregates;
}

export type Verdict = "working" | "ambiguous" | "broken";

export interface DerivedEconomics {
  trialToPaid: number;
  trialToPaidSource: "assumed" | "observed";
  observedTrialToPaid: number | null;
  appTrialToPaid: number;
  totalTrials: number;
  breakEvenCpaGbp: number;
  cpaGbp: number | null;
  netRevenuePerPayerUsd: number;
  netRevenuePerAppPayerUsd: number;
  expectedRevenueUsd: number;
  projectedPnlGbp: number;
  verdict: Verdict;
  learningPhase: boolean;
}

// Verdict thresholds. Heuristics agreed in the spec, not laws.
const BROKEN_MAX_PAYERS = 1;
const BROKEN_OBSERVED_RATE = 0.2;
const HEALTHY_OBSERVED_RATE = 0.4;

export function deriveEconomics(
  facts: AdsFacts,
  a: AdsAssumptions,
  opts?: { overrideCancelRate?: boolean },
): DerivedEconomics {
  const { cohort } = facts;
  const observed = cohort.decided >= a.minDecidedForActuals;
  const observedTrialToPaid = cohort.decided > 0 ? cohort.payers / cohort.decided : null;
  // An override models the user's edited cancel rate even once real actuals
  // exist; it is then the user's assumption driving trialToPaid, not Stripe's
  // observed outcome, so trialToPaidSource must say "assumed" too.
  const useObserved = observed && observedTrialToPaid != null && !opts?.overrideCancelRate;
  const trialToPaid = useObserved ? observedTrialToPaid : 1 - a.assumedTrialCancelRate;

  const netRevenuePerPayerUsd = a.annualPriceUsd * (1 - a.stripeFeeRate) * (1 - a.refundRate);
  // App payers pay the same list price; the store takes its fee instead of
  // Stripe's. App-store conversions are never observable per cohort (they
  // decide on Apple's/Google's servers), so the app rate is always assumed.
  const netRevenuePerAppPayerUsd = a.annualPriceUsd * (1 - a.storeFeeRate) * (1 - a.refundRate);
  const appTrialToPaid = 1 - a.assumedAppTrialCancelRate;

  const totalTrials = facts.stripeTrials + facts.appTrials;
  const cpaGbp = totalTrials > 0 ? facts.spendGbp / totalTrials : null;

  // Break-even is expected net revenue per trial, blended across where trials
  // decide: web trials at the web rate/fees, app trials at the app rate/fees.
  const webValuePerTrialGbp = netRevenuePerPayerUsd * trialToPaid * a.gbpPerUsd;
  const appValuePerTrialGbp = netRevenuePerAppPayerUsd * appTrialToPaid * a.gbpPerUsd;
  const breakEvenCpaGbp =
    totalTrials > 0
      ? (facts.stripeTrials * webValuePerTrialGbp + facts.appTrials * appValuePerTrialGbp) / totalTrials
      : webValuePerTrialGbp;

  const expectedRevenueUsd =
    cohort.payers * netRevenuePerPayerUsd +
    cohort.pending * trialToPaid * netRevenuePerPayerUsd +
    facts.appTrials * appTrialToPaid * netRevenuePerAppPayerUsd;
  const projectedPnlGbp = expectedRevenueUsd * a.gbpPerUsd - facts.spendGbp;

  let verdict: Verdict = "ambiguous";
  if (
    (cohort.decided >= a.minDecidedForActuals && cohort.payers <= BROKEN_MAX_PAYERS) ||
    (observed && observedTrialToPaid != null && observedTrialToPaid < BROKEN_OBSERVED_RATE)
  ) {
    verdict = "broken";
  } else if (
    cpaGbp != null &&
    cpaGbp <= breakEvenCpaGbp &&
    (!useObserved || trialToPaid >= HEALTHY_OBSERVED_RATE)
  ) {
    verdict = "working";
  }

  return {
    trialToPaid,
    trialToPaidSource: useObserved ? "observed" : "assumed",
    observedTrialToPaid,
    appTrialToPaid,
    totalTrials,
    breakEvenCpaGbp,
    cpaGbp,
    netRevenuePerPayerUsd,
    netRevenuePerAppPayerUsd,
    expectedRevenueUsd,
    projectedPnlGbp,
    verdict,
    learningPhase: facts.trialsLast7 < LEARNING_PHASE_WEEKLY_TRIALS,
  };
}

export function isModeling(current: AdsAssumptions, defaults: AdsAssumptions): boolean {
  return (Object.keys(defaults) as Array<keyof AdsAssumptions>).some(
    (k) => current[k] !== defaults[k],
  );
}
