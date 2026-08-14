// @vitest-environment node
import { describe, it, expect } from "vitest";
import { ADS_ASSUMPTIONS } from "@/lib/ads/config";
import { deriveEconomics, type AdsFacts } from "@/lib/ads/economics";
import { buildCohortChartSeries } from "@/lib/ads/chart";
import type { AdsEvalPayload } from "@/lib/ads/assemble";

const DAILY: AdsEvalPayload["daily"] = [
  { date: "2026-08-10", spendGbp: 20, stripeTrials: 3, appTrials: 0, collectedUsd: 0 },
  { date: "2026-08-11", spendGbp: 15, stripeTrials: 2, appTrials: 0, collectedUsd: 0 },
  { date: "2026-08-12", spendGbp: 25, stripeTrials: 5, appTrials: 0, collectedUsd: 89.97 },
];

const FACTS: AdsFacts = {
  spendGbp: 60,
  stripeTrials: 10,
  appTrials: 0,
  trialsLast7: 10,
  cohort: { trials: 10, decided: 8, payers: 4, canceled: 4, pastDue: 0, pending: 2, collectedUsd: 89.97 },
};

describe("buildCohortChartSeries", () => {
  it("final expected-revenue point equals economics.expectedRevenueUsd converted to GBP", () => {
    const economics = deriveEconomics(FACTS, ADS_ASSUMPTIONS);
    const gbpPerUsd = ADS_ASSUMPTIONS.gbpPerUsd;
    const points = buildCohortChartSeries(DAILY, economics, gbpPerUsd);
    const anchorGbp = Number((economics.expectedRevenueUsd * gbpPerUsd).toFixed(2));
    expect(points[points.length - 1].expectedRevenueGbp).toBeCloseTo(anchorGbp, 2);
  });

  it("keeps the intermediate shape proportional to cumulative trial starts", () => {
    const economics = deriveEconomics(FACTS, ADS_ASSUMPTIONS);
    const points = buildCohortChartSeries(DAILY, economics, ADS_ASSUMPTIONS.gbpPerUsd);
    // Cumulative trials: 3, 5, 10 -> ratios 3/10 and 5/10 of the final point.
    const final = points[2].expectedRevenueGbp;
    expect(points[0].expectedRevenueGbp).toBeCloseTo(final * (3 / 10), 1);
    expect(points[1].expectedRevenueGbp).toBeCloseTo(final * (5 / 10), 1);
  });

  it("guards division by zero when there are no trials at all", () => {
    const emptyDaily: AdsEvalPayload["daily"] = [
      { date: "2026-08-10", spendGbp: 0, stripeTrials: 0, appTrials: 0, collectedUsd: 0 },
    ];
    const emptyFacts: AdsFacts = {
      spendGbp: 0,
      stripeTrials: 0,
      appTrials: 0,
      trialsLast7: 0,
      cohort: { trials: 0, decided: 0, payers: 0, canceled: 0, pastDue: 0, pending: 0, collectedUsd: 0 },
    };
    const economics = deriveEconomics(emptyFacts, ADS_ASSUMPTIONS);
    const points = buildCohortChartSeries(emptyDaily, economics, ADS_ASSUMPTIONS.gbpPerUsd);
    expect(Number.isFinite(points[0].expectedRevenueGbp)).toBe(true);
    expect(points[0].expectedRevenueGbp).toBe(0);
  });

  it("suppresses the collected-revenue point when collectedUsd is 0", () => {
    const zeroCollectedDaily: AdsEvalPayload["daily"] = [
      { date: "2026-08-10", spendGbp: 10, stripeTrials: 1, appTrials: 0, collectedUsd: 0 },
    ];
    const economics = deriveEconomics(FACTS, ADS_ASSUMPTIONS);
    const points = buildCohortChartSeries(zeroCollectedDaily, economics, ADS_ASSUMPTIONS.gbpPerUsd);
    expect(points[points.length - 1].collectedRevenueGbp).toBeUndefined();
  });
});
