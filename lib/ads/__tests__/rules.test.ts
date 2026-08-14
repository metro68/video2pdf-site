// @vitest-environment node
import { describe, it, expect } from "vitest";
import { runRules, type RulesInput, type AdRowFacts } from "@/lib/ads/rules";
import type { DerivedEconomics } from "@/lib/ads/economics";

function econ(overrides: Partial<DerivedEconomics> = {}): DerivedEconomics {
  return {
    trialToPaid: 0.5,
    trialToPaidSource: "assumed",
    observedTrialToPaid: null,
    breakEvenCpaGbp: 10.6,
    cpaGbp: 9,
    netRevenuePerPayerUsd: 27.6,
    expectedRevenueUsd: 100,
    projectedPnlGbp: 10,
    verdict: "working",
    learningPhase: true,
    ...overrides,
  };
}

function ad(overrides: Partial<AdRowFacts> = {}): AdRowFacts {
  return {
    adId: "1", adName: "vid 1", adsetName: "UGC creatives ad", spendGbp: 10, impressions: 1000, clicks: 25,
    ctrPct: 2.5, cpcGbp: 0.4, contentViews: 20, emailStepViews: 12, leads: 8,
    checkouts: 4, pixelTrials: 2, cpaGbp: 5,
    ...overrides,
  };
}

function input(overrides: Partial<RulesInput> = {}): RulesInput {
  return {
    ads: [ad()],
    funnel: {
      clicks: 100, emailStepViews: 45, leads: 30, checkouts: 15, pixelTrials: 8,
      baselineClicks: 400, baselineEmailStepViews: 180,
    },
    economics: econ(),
    cpaSeries: [
      { date: "2026-08-10", cpaGbp: 10 },
      { date: "2026-08-11", cpaGbp: 11 },
      { date: "2026-08-12", cpaGbp: 10.5 },
    ],
    ...overrides,
  };
}

describe("change-creative rule", () => {
  it("fires for a creative with 1.5x CPA spent, sub-1% CTR, zero trials", () => {
    const r = runRules(input({ ads: [ad({ adId: "9", spendGbp: 18, ctrPct: 0.8, pixelTrials: 0, cpaGbp: null })] }));
    const hit = r.find((d) => d.id === "change-creative" && d.adId === "9");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("act");
  });

  it("does not fire when CTR is healthy or spend is low", () => {
    const r = runRules(input({ ads: [ad({ spendGbp: 5, ctrPct: 0.8, pixelTrials: 0 })] }));
    expect(r.find((d) => d.id === "change-creative")).toBeUndefined();
  });
});

describe("shorten-onboarding rule", () => {
  it("fires when click-to-email rate collapses vs baseline with healthy CTR", () => {
    // window rate 10/100 = 10 percent, baseline 180/400 = 45 percent
    const r = runRules(input({ funnel: { clicks: 100, emailStepViews: 10, leads: 8, checkouts: 4, pixelTrials: 2, baselineClicks: 400, baselineEmailStepViews: 180 } }));
    expect(r.find((d) => d.id === "shorten-onboarding")).toBeDefined();
  });

  it("does not fire when window rate tracks baseline", () => {
    const r = runRules(input());
    expect(r.find((d) => d.id === "shorten-onboarding")).toBeUndefined();
  });
});

describe("app-trial-instead-of-web rule", () => {
  it("fires when checkout-to-trial completion is under half", () => {
    const r = runRules(input({ funnel: { clicks: 100, emailStepViews: 45, leads: 30, checkouts: 20, pixelTrials: 6, baselineClicks: 400, baselineEmailStepViews: 180 } }));
    expect(r.find((d) => d.id === "app-trial-instead-of-web")).toBeDefined();
  });
});

describe("economics-branch rule", () => {
  it("urgent stop on broken", () => {
    const r = runRules(input({ economics: econ({ verdict: "broken" }) }));
    const hit = r.find((d) => d.id === "economics-branch");
    expect(hit!.severity).toBe("urgent");
    expect(hit!.title.toLowerCase()).toContain("stop");
  });

  it("hold on working", () => {
    const r = runRules(input());
    expect(r.find((d) => d.id === "economics-branch")!.severity).toBe("info");
  });
});

describe("normal-fluctuation-guard", () => {
  it("emits info card when day-over-day swings stay under 30 percent", () => {
    const r = runRules(input());
    expect(r.find((d) => d.id === "normal-fluctuation-guard")).toBeDefined();
  });

  it("absent when a swing exceeds 30 percent", () => {
    const r = runRules(input({ cpaSeries: [
      { date: "2026-08-10", cpaGbp: 10 },
      { date: "2026-08-11", cpaGbp: 16 },
    ] }));
    expect(r.find((d) => d.id === "normal-fluctuation-guard")).toBeUndefined();
  });
});

describe("ordering and framing", () => {
  it("orders urgent before act before info", () => {
    const r = runRules(input({
      economics: econ({ verdict: "broken" }),
      ads: [ad({ adId: "9", spendGbp: 18, ctrPct: 0.8, pixelTrials: 0, cpaGbp: null })],
    }));
    const sev = r.map((d) => d.severity);
    expect(sev.indexOf("urgent")).toBeLessThan(sev.indexOf("act"));
  });

  it("every deduction is framed as a hypothesis, never a pause-segment order", () => {
    const r = runRules(input({ economics: econ({ verdict: "broken" }) }));
    for (const d of r) {
      expect(d.hypothesis.length).toBeGreaterThan(0);
      expect(d.title.toLowerCase()).not.toContain("pause the");
    }
  });
});
