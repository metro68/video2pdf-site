// Single source of truth for subscription pricing and the MRR definition.
//
// MRR = active paid subscribers x the plan's normalized monthly price.
// A subscriber who cancels auto-renew but is still inside their paid period
// is still "active" (the store still lists them), so they stay in MRR until
// the period lapses. Only a refund removes them. This is the standard MRR
// definition and matches "how much is coming in this month".

// The only paid plan today: annual at $29.99/year.
export const ANNUAL_PRICE_USD = 29.99;

// Normalized monthly value of one active annual subscriber.
export const MONTHLY_PER_SUB_USD = ANNUAL_PRICE_USD / 12;

/** MRR from a total active-paid-subscriber count. */
export function mrrFromSubs(activeSubs: number): number {
  return Math.round(activeSubs * MONTHLY_PER_SUB_USD * 100) / 100;
}

/** ARR is simply MRR annualized. */
export function arrFromMrr(mrr: number): number {
  return Math.round(mrr * 12 * 100) / 100;
}
