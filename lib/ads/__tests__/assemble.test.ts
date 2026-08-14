// @vitest-environment node
import { describe, it, expect } from "vitest";
import { assemblePayload } from "@/lib/ads/assemble";
import type { AdDailyRow } from "@/lib/connectors/meta";
import type { TrialCohort } from "@/lib/connectors/stripe";

const NOW = new Date("2026-08-14T12:00:00Z");

function row(overrides: Partial<AdDailyRow> = {}): AdDailyRow {
  return {
    adId: "1", adName: "Delf 1", campaignName: "U.S ad", date: "2026-08-12", spend: 10, impressions: 500,
    clicks: 12, contentViews: 9, emailStepViews: 6, leads: 4, checkouts: 2, trials: 1,
    ...overrides,
  };
}

const COHORT: TrialCohort = {
  trials: [],
  aggregates: { trials: 4, decided: 2, payers: 1, canceled: 1, pastDue: 0, pending: 2, collectedUsd: 29.99 },
  dailyTrials: [
    { date: "2026-08-11", count: 1 },
    { date: "2026-08-12", count: 3 },
  ],
};

describe("assemblePayload", () => {
  it("aggregates ad rows in the window and computes rates", () => {
    const p = assemblePayload({
      adRows: [
        row(),
        row({ date: "2026-08-13", spend: 5, clicks: 3, impressions: 100, trials: 0 }),
        row({ adId: "2", adName: "vid 1", date: "2026-08-12", spend: 3, clicks: 5, impressions: 80, trials: 0 }),
        row({ date: "2026-07-01" }), // outside 14-day window, baseline only
      ],
      cohort: COHORT,
      windowDays: 14,
      now: NOW,
    });
    expect(p.status).toBe("ok");
    expect(p.ads).toHaveLength(2);
    const delf = p.ads.find((a) => a.adId === "1")!;
    expect(delf.spendGbp).toBeCloseTo(15);
    expect(delf.ctrPct).toBeCloseTo((15 / 600) * 100);
    expect(delf.cpaGbp).toBeCloseTo(15 / 1);
    expect(p.funnel.baselineClicks).toBeGreaterThan(p.funnel.clicks);
    expect(p.facts.stripeTrials).toBe(4);
    expect(p.facts.spendGbp).toBeCloseTo(18);
    expect(p.deductions.length).toBeGreaterThan(0);
  });

  it("is partial when meta failed but stripe delivered", () => {
    const p = assemblePayload({ adRows: null, cohort: COHORT, windowDays: 14, now: NOW, metaError: "boom" });
    expect(p.status).toBe("partial");
    expect(p.errors.meta).toBe("boom");
    expect(p.facts.stripeTrials).toBe(4);
  });

  it("is error when both sources failed", () => {
    const p = assemblePayload({ adRows: null, cohort: null, windowDays: 14, now: NOW, metaError: "a", stripeError: "b" });
    expect(p.status).toBe("error");
  });
});
