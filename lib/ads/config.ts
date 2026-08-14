import { FUNNEL_CONFIG } from "@/lib/funnel/config";

export interface AdsAssumptions {
  annualPriceUsd: number;
  trialDays: number;
  /** Share of decided web trials that cancel before first billing. */
  assumedTrialCancelRate: number;
  /** Share of app-store trials assumed to cancel; app conversions are never
   * observable per cohort, so this rate is always an assumption. */
  assumedAppTrialCancelRate: number;
  /** App store commission on app subscriptions (15% small business tier). */
  storeFeeRate: number;
  /** Below this many decided trials, economics use the assumed rate. */
  minDecidedForActuals: number;
  stripeFeeRate: number;
  refundRate: number;
  /** Manual FX constant: Meta bills GBP, Stripe collects USD. */
  gbpPerUsd: number;
}

export const ADS_ASSUMPTIONS: AdsAssumptions = {
  annualPriceUsd: FUNNEL_CONFIG.plans.annual.cents / 100,
  trialDays: FUNNEL_CONFIG.plans.annual.trialDays,
  assumedTrialCancelRate: 0.5,
  assumedAppTrialCancelRate: 0.65,
  storeFeeRate: 0.15,
  minDecidedForActuals: 15,
  stripeFeeRate: 0.03,
  refundRate: 0.05,
  gbpPerUsd: 0.77,
};

/** Ad set exits Meta's learning phase around this many weekly conversions. */
export const LEARNING_PHASE_WEEKLY_TRIALS = 50;
