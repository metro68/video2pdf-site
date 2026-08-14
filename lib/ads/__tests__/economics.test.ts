// @vitest-environment node
import { describe, it, expect } from "vitest";
import { ADS_ASSUMPTIONS } from "@/lib/ads/config";
import { deriveEconomics, isModeling, type AdsFacts } from "@/lib/ads/economics";

const A = ADS_ASSUMPTIONS;

function facts(overrides: Partial<AdsFacts> = {}): AdsFacts {
  return {
    spendGbp: 100,
    stripeTrials: 10,
    trialsLast7: 10,
    cohort: { trials: 10, decided: 0, payers: 0, canceled: 0, pastDue: 0, pending: 10, collectedUsd: 0 },
    ...overrides,
  };
}

describe("deriveEconomics: assumed vs observed switch", () => {
  it("uses the assumed rate below minDecidedForActuals", () => {
    const d = deriveEconomics(facts({ cohort: { trials: 20, decided: 14, payers: 7, canceled: 7, pastDue: 0, pending: 6, collectedUsd: 0 } }), A);
    expect(d.trialToPaidSource).toBe("assumed");
    expect(d.trialToPaid).toBeCloseTo(1 - A.assumedTrialCancelRate);
  });

  it("switches to observed at exactly minDecidedForActuals", () => {
    const d = deriveEconomics(facts({ cohort: { trials: 20, decided: 15, payers: 6, canceled: 9, pastDue: 0, pending: 5, collectedUsd: 0 } }), A);
    expect(d.trialToPaidSource).toBe("observed");
    expect(d.trialToPaid).toBeCloseTo(6 / 15);
    expect(d.observedTrialToPaid).toBeCloseTo(6 / 15);
  });
});

describe("deriveEconomics: break-even math", () => {
  it("matches the spec sensitivity table at 50% cancels", () => {
    // 29.99 * 0.97 * 0.95 * 0.5 * 0.77 ~ 10.64 GBP
    const d = deriveEconomics(facts(), { ...A, assumedTrialCancelRate: 0.5 });
    expect(d.breakEvenCpaGbp).toBeGreaterThan(10.3);
    expect(d.breakEvenCpaGbp).toBeLessThan(11.0);
  });

  it("higher cancel rate lowers break-even", () => {
    const d40 = deriveEconomics(facts(), { ...A, assumedTrialCancelRate: 0.6 });
    const d60 = deriveEconomics(facts(), { ...A, assumedTrialCancelRate: 0.4 });
    expect(d40.breakEvenCpaGbp).toBeLessThan(d60.breakEvenCpaGbp);
  });
});

describe("deriveEconomics: cpa, expected revenue, P&L", () => {
  it("cpa is spend over stripe trials, null with zero trials", () => {
    expect(deriveEconomics(facts({ spendGbp: 116.1, stripeTrials: 10 }), A).cpaGbp).toBeCloseTo(11.61);
    expect(deriveEconomics(facts({ stripeTrials: 0, cohort: { trials: 0, decided: 0, payers: 0, canceled: 0, pastDue: 0, pending: 0, collectedUsd: 0 } }), A).cpaGbp).toBeNull();
  });

  it("expected revenue counts payers at net price and pending at trialToPaid", () => {
    const f = facts({ cohort: { trials: 10, decided: 5, payers: 3, canceled: 2, pastDue: 0, pending: 5, collectedUsd: 89.97 } });
    const d = deriveEconomics(f, A);
    const net = 29.99 * (1 - A.stripeFeeRate) * (1 - A.refundRate);
    expect(d.netRevenuePerPayerUsd).toBeCloseTo(net);
    expect(d.expectedRevenueUsd).toBeCloseTo(3 * net + 5 * d.trialToPaid * net);
    expect(d.projectedPnlGbp).toBeCloseTo(d.expectedRevenueUsd * A.gbpPerUsd - f.spendGbp);
  });
});

describe("deriveEconomics: verdict", () => {
  it("broken when 15+ decided and payers <= 1", () => {
    const d = deriveEconomics(facts({ cohort: { trials: 16, decided: 15, payers: 1, canceled: 14, pastDue: 0, pending: 1, collectedUsd: 0 } }), A);
    expect(d.verdict).toBe("broken");
  });

  it("working when cpa at or under break-even and rate healthy", () => {
    const d = deriveEconomics(facts({ spendGbp: 50, stripeTrials: 10 }), A); // cpa 5, assumed rate
    expect(d.verdict).toBe("working");
  });

  it("ambiguous when cpa above break-even but payers exist", () => {
    const d = deriveEconomics(facts({ spendGbp: 300, stripeTrials: 10, cohort: { trials: 10, decided: 8, payers: 4, canceled: 4, pastDue: 0, pending: 2, collectedUsd: 0 } }), A);
    expect(d.verdict).toBe("ambiguous");
  });

  it("learningPhase true under 50 trials in trailing 7 days", () => {
    expect(deriveEconomics(facts({ trialsLast7: 30 }), A).learningPhase).toBe(true);
    expect(deriveEconomics(facts({ trialsLast7: 50 }), A).learningPhase).toBe(false);
  });
});

describe("deriveEconomics: overrideCancelRate", () => {
  const COHORT_20_DECIDED = { trials: 20, decided: 20, payers: 10, canceled: 10, pastDue: 0, pending: 0, collectedUsd: 0 };

  it("with 15+ decided and override true, trialToPaid equals the edited assumption, not the observed rate", () => {
    const editedAssumptions = { ...A, assumedTrialCancelRate: 0.7 };
    const d = deriveEconomics(facts({ cohort: COHORT_20_DECIDED }), editedAssumptions, { overrideCancelRate: true });
    expect(d.trialToPaid).toBeCloseTo(1 - 0.7);
    expect(d.trialToPaidSource).toBe("assumed");
    // Observed rate is still reported for the UI's "observed: X%" helper text.
    expect(d.observedTrialToPaid).toBeCloseTo(10 / 20);
  });

  it("with override false (default), the observed rate wins once actuals exist", () => {
    const d = deriveEconomics(facts({ cohort: COHORT_20_DECIDED }), A);
    expect(d.trialToPaid).toBeCloseTo(10 / 20);
    expect(d.trialToPaidSource).toBe("observed");
  });

  it("server callers passing no opts are unaffected (assemble.ts behavior unchanged)", () => {
    const withNoOpts = deriveEconomics(facts({ cohort: COHORT_20_DECIDED }), A);
    const withExplicitFalse = deriveEconomics(facts({ cohort: COHORT_20_DECIDED }), A, { overrideCancelRate: false });
    expect(withNoOpts).toEqual(withExplicitFalse);
  });
});

describe("isModeling", () => {
  it("false when equal, true when any field differs", () => {
    expect(isModeling(A, A)).toBe(false);
    expect(isModeling({ ...A, annualPriceUsd: 39.99 }, A)).toBe(true);
  });
});
