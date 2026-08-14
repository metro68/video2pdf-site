import type { AdsEvalPayload } from "@/lib/ads/assemble";
import type { DerivedEconomics } from "@/lib/ads/economics";

export interface CohortChartPoint {
  label: string;
  spendGbp: number;
  expectedRevenueGbp: number;
  collectedRevenueGbp: number | undefined;
}

/**
 * Builds the cumulative spend / expected-revenue / collected-revenue series
 * for the cohort chart. The expected-revenue curve is shaped by cumulative
 * trial starts (more trials in a day means a steeper climb that day) but is
 * proportionally scaled so its final point lands exactly on
 * economics.expectedRevenueUsd converted to GBP, the same number the P&L
 * tile uses. Without this scaling, weighting every cumulative trial at
 * trialToPaid overstates revenue versus deriveEconomics, which only weights
 * *pending* trials at trialToPaid and counts decided payers/cancels exactly.
 */
export function buildCohortChartSeries(
  daily: AdsEvalPayload["daily"],
  economics: DerivedEconomics,
  gbpPerUsd: number,
): CohortChartPoint[] {
  let lastCollectedUsd = 0;
  for (const d of daily) {
    if (d.collectedUsd > 0) lastCollectedUsd = d.collectedUsd;
  }
  const collectedRevenueGbp = Number((lastCollectedUsd * gbpPerUsd).toFixed(2));

  const anchorGbp = economics.expectedRevenueUsd * gbpPerUsd;

  let cumTrials = 0;
  const unscaled = daily.map((d) => {
    cumTrials += d.stripeTrials + d.appTrials;
    return cumTrials * economics.trialToPaid * economics.netRevenuePerPayerUsd * gbpPerUsd;
  });
  const unscaledFinal = unscaled[unscaled.length - 1] ?? 0;
  const scale = unscaledFinal !== 0 ? anchorGbp / unscaledFinal : 0;

  let cumSpend = 0;
  return daily.map((d, i) => {
    cumSpend += d.spendGbp;
    const expectedRevenueGbp = unscaled[i] * scale;
    return {
      label: d.date.slice(5),
      spendGbp: Number(cumSpend.toFixed(2)),
      expectedRevenueGbp: Number(expectedRevenueGbp.toFixed(2)),
      collectedRevenueGbp: i === daily.length - 1 && collectedRevenueGbp > 0 ? collectedRevenueGbp : undefined,
    };
  });
}
