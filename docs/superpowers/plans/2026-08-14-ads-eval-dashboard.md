# Ads Eval Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-only `/dashboard/ads` view joining Meta ad-level insights with Stripe trial cohorts: verdict banner, KPI tiles, cohort chart, per-ad table, deterministic deductions, and an editable what-if assumptions panel.

**Architecture:** Raw facts come from two extended connectors (Meta ad-level insights, Stripe trial cohort) joined in one API route that also runs a pure rules engine. All derived economics live in a pure client-callable module so the assumptions panel can re-model outcomes with zero refetch. UI reuses the existing dashboard components and styling.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind (brand-* tokens), recharts, Vitest, Stripe SDK, Meta Graph API v25.0.

**Spec:** `docs/superpowers/specs/2026-08-14-ads-eval-dashboard-design.md`

## Global Constraints

- TypeScript strict; no `any` without a comment explaining why.
- Absolute imports via `@/...`.
- No em dashes in any copy, comments, or strings. Use commas, colons, parentheses.
- Business logic in `lib/`, not components or route handlers.
- Run `npm run lint` before pushing; tests via `npx vitest run`.
- All work in repo `video2pdf-site`, branch `ads-eval-dashboard` cut from `main`.
- No LLM/AI API anywhere. No write calls to Meta. Meta Graph version: `v25.0`.
- Currency: Meta spend is GBP, Stripe revenue USD; convert via `gbpPerUsd` constant only.
- Every panel/tile gets a plain-language context note (source, lag, assumptions), same style as existing dashboard tiles.

---

### Task 1: Assumptions config + economics derivation

**Files:**
- Create: `lib/ads/config.ts`
- Create: `lib/ads/economics.ts`
- Test: `lib/ads/__tests__/economics.test.ts`

**Interfaces:**
- Consumes: `FUNNEL_CONFIG` from `@/lib/funnel/config` (annual cents 2999, trialDays 3).
- Produces (used by Tasks 2, 5, 7):

```ts
// lib/ads/config.ts
export interface AdsAssumptions {
  annualPriceUsd: number;
  trialDays: number;
  assumedTrialCancelRate: number; // share of decided trials that cancel
  minDecidedForActuals: number;
  stripeFeeRate: number;
  refundRate: number;
  gbpPerUsd: number;
}
export const ADS_ASSUMPTIONS: AdsAssumptions;

// lib/ads/economics.ts
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
  stripeTrials: number;   // cohort.trials, the economics truth
  trialsLast7: number;    // stripe trials in the trailing 7 days
  cohort: CohortAggregates;
}
export type Verdict = "working" | "ambiguous" | "broken";
export interface DerivedEconomics {
  trialToPaid: number;
  trialToPaidSource: "assumed" | "observed";
  observedTrialToPaid: number | null;
  breakEvenCpaGbp: number;
  cpaGbp: number | null;
  netRevenuePerPayerUsd: number;
  expectedRevenueUsd: number;
  projectedPnlGbp: number;
  verdict: Verdict;
  learningPhase: boolean;
}
export function deriveEconomics(facts: AdsFacts, a: AdsAssumptions): DerivedEconomics;
export function isModeling(current: AdsAssumptions, defaults: AdsAssumptions): boolean;
```

- [ ] **Step 1: Write the failing tests**

`lib/ads/__tests__/economics.test.ts`:

```ts
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

describe("isModeling", () => {
  it("false when equal, true when any field differs", () => {
    expect(isModeling(A, A)).toBe(false);
    expect(isModeling({ ...A, annualPriceUsd: 39.99 }, A)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/ads/__tests__/economics.test.ts`
Expected: FAIL, cannot resolve `@/lib/ads/config`.

- [ ] **Step 3: Implement config and economics**

`lib/ads/config.ts`:

```ts
import { FUNNEL_CONFIG } from "@/lib/funnel/config";

export interface AdsAssumptions {
  annualPriceUsd: number;
  trialDays: number;
  /** Share of decided trials that cancel before first billing. */
  assumedTrialCancelRate: number;
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
  minDecidedForActuals: 15,
  stripeFeeRate: 0.03,
  refundRate: 0.05,
  gbpPerUsd: 0.77,
};

/** Ad set exits Meta's learning phase around this many weekly conversions. */
export const LEARNING_PHASE_WEEKLY_TRIALS = 50;
```

`lib/ads/economics.ts`:

```ts
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
  trialsLast7: number;
  cohort: CohortAggregates;
}

export type Verdict = "working" | "ambiguous" | "broken";

export interface DerivedEconomics {
  trialToPaid: number;
  trialToPaidSource: "assumed" | "observed";
  observedTrialToPaid: number | null;
  breakEvenCpaGbp: number;
  cpaGbp: number | null;
  netRevenuePerPayerUsd: number;
  expectedRevenueUsd: number;
  projectedPnlGbp: number;
  verdict: Verdict;
  learningPhase: boolean;
}

// Verdict thresholds. Heuristics agreed in the spec, not laws.
const BROKEN_MAX_PAYERS = 1;
const BROKEN_OBSERVED_RATE = 0.2;
const HEALTHY_OBSERVED_RATE = 0.4;

export function deriveEconomics(facts: AdsFacts, a: AdsAssumptions): DerivedEconomics {
  const { cohort } = facts;
  const observed = cohort.decided >= a.minDecidedForActuals;
  const observedTrialToPaid = cohort.decided > 0 ? cohort.payers / cohort.decided : null;
  const trialToPaid = observed && observedTrialToPaid != null ? observedTrialToPaid : 1 - a.assumedTrialCancelRate;

  const netRevenuePerPayerUsd = a.annualPriceUsd * (1 - a.stripeFeeRate) * (1 - a.refundRate);
  const breakEvenCpaGbp = netRevenuePerPayerUsd * trialToPaid * a.gbpPerUsd;
  const cpaGbp = facts.stripeTrials > 0 ? facts.spendGbp / facts.stripeTrials : null;

  const expectedRevenueUsd =
    cohort.payers * netRevenuePerPayerUsd + cohort.pending * trialToPaid * netRevenuePerPayerUsd;
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
    (!observed || trialToPaid >= HEALTHY_OBSERVED_RATE)
  ) {
    verdict = "working";
  }

  return {
    trialToPaid,
    trialToPaidSource: observed ? "observed" : "assumed",
    observedTrialToPaid,
    breakEvenCpaGbp,
    cpaGbp,
    netRevenuePerPayerUsd,
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/ads/__tests__/economics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ads/config.ts lib/ads/economics.ts lib/ads/__tests__/economics.test.ts
git commit -m "Add ads assumptions config and pure economics derivation"
```

---

### Task 2: Rules engine

**Files:**
- Create: `lib/ads/rules.ts`
- Test: `lib/ads/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: `DerivedEconomics`, `Verdict` from `@/lib/ads/economics` (Task 1).
- Produces (used by Tasks 5, 7):

```ts
export interface AdRowFacts {
  adId: string;
  adName: string;
  spendGbp: number;
  impressions: number;
  clicks: number;
  ctrPct: number;          // link CTR percent, e.g. 1.83
  cpcGbp: number | null;
  contentViews: number;
  emailStepViews: number;
  leads: number;
  checkouts: number;
  pixelTrials: number;
  cpaGbp: number | null;   // spendGbp / pixelTrials
}
export interface AccountFunnelFacts {
  clicks: number;
  emailStepViews: number;
  leads: number;
  checkouts: number;
  pixelTrials: number;
  /** Same rates over the trailing 30 days, the baseline for drop-off rules. */
  baselineClicks: number;
  baselineEmailStepViews: number;
}
export interface RulesInput {
  ads: AdRowFacts[];
  funnel: AccountFunnelFacts;
  economics: DerivedEconomics;
  /** Daily account CPA (GBP) for the window, oldest first; null = no trials that day. */
  cpaSeries: Array<{ date: string; cpaGbp: number | null }>;
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
export function runRules(input: RulesInput): Deduction[];
```

- [ ] **Step 1: Write the failing tests**

`lib/ads/__tests__/rules.test.ts`:

```ts
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
    adId: "1", adName: "vid 1", spendGbp: 10, impressions: 1000, clicks: 25,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/ads/__tests__/rules.test.ts`
Expected: FAIL, cannot resolve `@/lib/ads/rules`.

- [ ] **Step 3: Implement the rules engine**

`lib/ads/rules.ts`:

```ts
import type { DerivedEconomics } from "@/lib/ads/economics";

export interface AdRowFacts {
  adId: string;
  adName: string;
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
  const { ads, funnel, economics, cpaSeries } = input;

  // change-creative, per ad
  const cpaFloor = Math.max(economics.cpaGbp ?? economics.breakEvenCpaGbp, CREATIVE_MIN_SPEND_GBP / CREATIVE_SPEND_X_CPA);
  for (const ad of ads) {
    if (ad.spendGbp >= CREATIVE_SPEND_X_CPA * cpaFloor && ad.ctrPct < CREATIVE_LOW_CTR_PCT && ad.pixelTrials === 0) {
      out.push({
        id: "change-creative",
        severity: "act",
        adId: ad.adId,
        title: `Swap creative "${ad.adName}" for one in the wings`,
        evidence: `${ad.adName}: £${ad.spendGbp.toFixed(2)} spent, CTR ${ad.ctrPct.toFixed(2)}%, 0 trials.`,
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

  // app-trial-instead-of-web, account level
  const completion = funnel.checkouts > 0 ? funnel.pixelTrials / funnel.checkouts : null;
  if (completion != null && funnel.checkouts >= MIN_CHECKOUTS_FOR_SIGNAL && completion < CHECKOUT_COMPLETION_FLOOR) {
    out.push({
      id: "app-trial-instead-of-web",
      severity: "act",
      title: "Test routing to the app store free trial instead of web checkout",
      evidence: `${funnel.pixelTrials} trials from ${funnel.checkouts} checkout starts (${pct(completion)} completion).`,
      rationale: "Leads reach checkout but stall at payment entry; a store trial removes card entry friction at the cost of the store fee.",
      hypothesis: "Store-trial routing converts over half of checkout starters, net of the 15-30% store fee.",
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/ads/__tests__/rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ads/rules.ts lib/ads/__tests__/rules.test.ts
git commit -m "Add deterministic ads deduction rules engine"
```

---

### Task 3: Meta ad-level insights connector

**Files:**
- Modify: `lib/connectors/meta.ts`
- Test: `lib/connectors/__tests__/meta-ads.test.ts`

**Interfaces:**
- Consumes: existing `GRAPH_VERSION`, `getCached`/`setCached` from `@/lib/cache`.
- Produces (used by Task 5):

```ts
export interface AdDailyRow {
  adId: string;
  adName: string;
  date: string;            // YYYY-MM-DD
  spend: number;           // account currency (GBP)
  impressions: number;
  clicks: number;          // link clicks
  contentViews: number;
  emailStepViews: number;
  leads: number;
  checkouts: number;
  trials: number;
}
export function normalizeAdInsights(raw: unknown): AdDailyRow[];
/** Trailing-30-day daily ad rows; the route slices its own window. */
export function fetchAdInsights(): Promise<ConnectorResult<AdDailyRow[]>>;
```

**Notes for the implementer:**
- One API call fetches the trailing 30 days at `level=ad` with `time_increment=1`; the route derives any 7/14/30-day window and the 30-day baseline from the same cached payload.
- Meta reports funnel events in the `actions` array as `{ action_type, value }`. Standard pixel events use types like `offsite_conversion.fb_pixel_view_content`, `offsite_conversion.fb_pixel_lead`, `offsite_conversion.fb_pixel_initiate_checkout`; custom events and custom conversions appear as `offsite_conversion.custom.<id-or-name>` and the exact strings vary by account. Therefore match by substring, and verify against the live account during this task: if `.env.local` has `META_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID`, run the curl below, read the real `action_type` strings, and adjust `ACTION_MATCHERS` to match them exactly (add the custom-conversion id for `start_trial_website` if that is how it appears). If no local credentials exist, keep the substring matchers and leave a comment saying they are pending live verification.

```bash
source .env.local 2>/dev/null; ACC=${META_AD_ACCOUNT_ID#act_}; curl -s "https://graph.facebook.com/v25.0/act_${ACC}/insights?level=ad&time_increment=1&date_preset=last_7d&fields=ad_id,ad_name,spend,impressions,inline_link_clicks,actions&access_token=${META_ACCESS_TOKEN}" | head -c 3000
```

- [ ] **Step 1: Write the failing tests**

`lib/connectors/__tests__/meta-ads.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { clearCache } from "@/lib/cache";
import { normalizeAdInsights, fetchAdInsights } from "@/lib/connectors/meta";

beforeEach(() => {
  clearCache();
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.META_AD_ACCOUNT_ID;
});

const RAW = {
  data: [
    {
      ad_id: "120210000001",
      ad_name: "UgcM- vid 2",
      date_start: "2026-08-12",
      date_stop: "2026-08-12",
      spend: "7.50",
      impressions: "455",
      inline_link_clicks: "8",
      actions: [
        { action_type: "offsite_conversion.fb_pixel_view_content", value: "6" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "3" },
        { action_type: "offsite_conversion.fb_pixel_initiate_checkout", value: "2" },
        { action_type: "offsite_conversion.custom.start_trial_website", value: "1" },
        { action_type: "offsite_conversion.custom.funnel_email_step_viewed", value: "4" },
        { action_type: "post_engagement", value: "12" },
      ],
    },
  ],
};

describe("normalizeAdInsights", () => {
  it("maps a raw row to an AdDailyRow with funnel counts", () => {
    const rows = normalizeAdInsights(RAW);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.adId).toBe("120210000001");
    expect(r.date).toBe("2026-08-12");
    expect(r.spend).toBeCloseTo(7.5);
    expect(r.clicks).toBe(8);
    expect(r.contentViews).toBe(6);
    expect(r.leads).toBe(3);
    expect(r.checkouts).toBe(2);
    expect(r.trials).toBe(1);
    expect(r.emailStepViews).toBe(4);
  });

  it("returns empty for missing or malformed payloads", () => {
    expect(normalizeAdInsights(null)).toEqual([]);
    expect(normalizeAdInsights({})).toEqual([]);
    expect(normalizeAdInsights({ data: [{}] })).toHaveLength(1); // zeros, not a crash
  });
});

describe("fetchAdInsights", () => {
  it("returns awaiting_credentials without env", async () => {
    const r = await fetchAdInsights();
    expect(r.status).toBe("awaiting_credentials");
    expect(r.data).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/connectors/__tests__/meta-ads.test.ts`
Expected: FAIL, `normalizeAdInsights` is not exported.

- [ ] **Step 3: Implement in `lib/connectors/meta.ts`** (append; do not touch the existing month-level `fetchMetrics`)

```ts
export interface AdDailyRow {
  adId: string;
  adName: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  contentViews: number;
  emailStepViews: number;
  leads: number;
  checkouts: number;
  trials: number;
}

// Insights `actions` types vary by account setup, so match by substring.
// Verified against the live account where possible; see the ads-eval plan.
const ACTION_MATCHERS: Array<{ key: keyof Pick<AdDailyRow, "contentViews" | "emailStepViews" | "leads" | "checkouts" | "trials">; match: string }> = [
  { key: "contentViews", match: "view_content" },
  { key: "emailStepViews", match: "funnel_email_step_viewed" },
  { key: "leads", match: "pixel_lead" },
  { key: "checkouts", match: "initiate_checkout" },
  { key: "trials", match: "start_trial" },
];

export function normalizeAdInsights(raw: unknown): AdDailyRow[] {
  const data = (raw as { data?: Array<Record<string, unknown>> } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const out: AdDailyRow = {
      adId: String(row.ad_id ?? ""),
      adName: String(row.ad_name ?? ""),
      date: String(row.date_start ?? ""),
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.inline_link_clicks ?? 0),
      contentViews: 0,
      emailStepViews: 0,
      leads: 0,
      checkouts: 0,
      trials: 0,
    };
    const actions = row.actions as Array<{ action_type?: string; value?: string }> | undefined;
    for (const a of actions ?? []) {
      const type = a.action_type ?? "";
      for (const m of ACTION_MATCHERS) {
        if (type.includes(m.match)) out[m.key] += Number(a.value ?? 0);
      }
    }
    return out;
  });
}

const AD_INSIGHTS_CACHE_KEY = "connector:meta:ad-insights";
const AD_INSIGHTS_DAYS = 30;

async function fetchAdInsightsRaw(): Promise<unknown> {
  const token = process.env.META_ACCESS_TOKEN!;
  const rawAccount = process.env.META_AD_ACCOUNT_ID!;
  const account = rawAccount.startsWith("act_") ? rawAccount : `act_${rawAccount}`;
  const until = new Date();
  const since = new Date(until.getTime() - AD_INSIGHTS_DAYS * 864e5);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    level: "ad",
    time_increment: "1",
    fields: "ad_id,ad_name,spend,impressions,inline_link_clicks,actions",
    time_range: JSON.stringify({ since: day(since), until: day(until) }),
    limit: "500",
    access_token: token,
  });
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${account}/insights?${params.toString()}`);
  if (!res.ok) throw new Error(`meta ad insights fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function fetchAdInsights(): Promise<ConnectorResult<AdDailyRow[]>> {
  if (!hasCredentials()) return { data: null, asOf: null, status: "awaiting_credentials" };
  const cached = getCached<AdDailyRow[]>(AD_INSIGHTS_CACHE_KEY);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const data = normalizeAdInsights(await fetchAdInsightsRaw());
    const asOf = setCached(AD_INSIGHTS_CACHE_KEY, data);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/connectors/__tests__/meta-ads.test.ts lib/connectors/__tests__/connectors.test.ts`
Expected: PASS, including the pre-existing connector tests.

- [ ] **Step 5: Verify live action_type strings (best effort)**

If `.env.local` contains META credentials, run the curl from the notes above, compare the real `action_type` strings against `ACTION_MATCHERS`, and tighten matchers if they differ. Update the fixture in the test to mirror reality if changed. If no credentials, skip and leave the pending-verification comment in place.

- [ ] **Step 6: Commit**

```bash
git add lib/connectors/meta.ts lib/connectors/__tests__/meta-ads.test.ts
git commit -m "Add trailing-30-day ad-level Meta insights with funnel actions"
```

---

### Task 4: Stripe trial cohort

**Files:**
- Modify: `lib/connectors/stripe.ts`
- Test: `lib/connectors/__tests__/stripe-cohort.test.ts`

**Interfaces:**
- Consumes: `getStripe` from `@/lib/stripe/client`, `ADS_ASSUMPTIONS.trialDays` from Task 1, `CohortAggregates` from Task 1.
- Produces (used by Task 5):

```ts
export interface TrialRecord {
  startedAt: string;                      // ISO date-time
  decided: boolean;                       // trial_start + trialDays is in the past
  outcome: "paid" | "canceled" | "past_due" | "pending";
  priceUsd: number;                       // plan unit_amount / 100
}
export interface TrialCohort {
  trials: TrialRecord[];
  aggregates: CohortAggregates;           // from @/lib/ads/economics
  dailyTrials: Array<{ date: string; count: number }>;
}
export function classifyTrial(sub: MinimalSub, nowSec: number, trialDays: number): TrialRecord;
export function fetchTrialCohort(fromIso: string, toIso: string): Promise<ConnectorResult<TrialCohort>>;
```

**Classification rules (the heart of this task):**
- Only subscriptions with `trial_start` inside `[from, to]` belong to the cohort.
- Outcome by current subscription status: `active` = paid; `trialing` = pending; `past_due` = past_due (NOT a payer while Stripe retries, matching the existing pause-access policy); `canceled`/`incomplete_expired`/`unpaid` = canceled.
- `decided` = window elapsed (`nowSec >= trial_start + trialDays * 86400`) OR outcome is not pending. An early cancellation decides a trial before its window elapses; a sub still `trialing` past its window (a transient state around the billing attempt) counts as decided so the boundary is stable.
- Aggregates: `trials` = all; `payers`/`canceled`/`pastDue`/`pending` = counts by outcome; `decided` = count of records with `decided: true`; `collectedUsd` = sum of `priceUsd` over paid trials (approximation of collected revenue, noted in UI copy).

- [ ] **Step 1: Write the failing tests**

`lib/connectors/__tests__/stripe-cohort.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => ({ subscriptions: { list } }) }));

import { classifyTrial, fetchTrialCohort } from "@/lib/connectors/stripe";

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 7, 14) / 1000); // 2026-08-14T00:00:00Z

function sub(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "trialing",
    trial_start: NOW - 1 * DAY,
    items: { data: [{ price: { unit_amount: 2999, recurring: { interval: "year" } }, quantity: 1 }] },
    ...overrides,
  };
}

describe("classifyTrial", () => {
  it("fresh trialing sub is pending and not decided", () => {
    const t = classifyTrial(sub(), NOW, 3);
    expect(t.outcome).toBe("pending");
    expect(t.decided).toBe(false);
    expect(t.priceUsd).toBeCloseTo(29.99);
  });

  it("active sub past its window is a decided payer", () => {
    const t = classifyTrial(sub({ status: "active", trial_start: NOW - 5 * DAY }), NOW, 3);
    expect(t.outcome).toBe("paid");
    expect(t.decided).toBe(true);
  });

  it("early cancellation is decided even inside the window", () => {
    const t = classifyTrial(sub({ status: "canceled", trial_start: NOW - 1 * DAY }), NOW, 3);
    expect(t.outcome).toBe("canceled");
    expect(t.decided).toBe(true);
  });

  it("past_due is decided but not a payer", () => {
    const t = classifyTrial(sub({ status: "past_due", trial_start: NOW - 5 * DAY }), NOW, 3);
    expect(t.outcome).toBe("past_due");
    expect(t.decided).toBe(true);
  });

  it("boundary: decided flips exactly at trial_start + trialDays", () => {
    expect(classifyTrial(sub({ trial_start: NOW - 3 * DAY }), NOW, 3).decided).toBe(true);
    expect(classifyTrial(sub({ trial_start: NOW - 3 * DAY + 1 }), NOW, 3).decided).toBe(false);
  });
});

describe("fetchTrialCohort", () => {
  beforeEach(() => {
    list.mockReset();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  });

  it("aggregates outcomes and daily counts over the window", async () => {
    list.mockResolvedValueOnce({
      data: [
        sub({ id: "a", status: "active", trial_start: NOW - 6 * DAY }),
        sub({ id: "b", status: "canceled", trial_start: NOW - 6 * DAY }),
        sub({ id: "c", status: "trialing", trial_start: NOW - 1 * DAY }),
        sub({ id: "d", status: "trialing", trial_start: NOW - 40 * DAY }), // outside window, dropped
      ],
      has_more: false,
    });
    const r = await fetchTrialCohort("2026-08-01", "2026-08-14");
    expect(r.status).toBe("ok");
    const agg = r.data!.aggregates;
    expect(agg.trials).toBe(3);
    expect(agg.payers).toBe(1);
    expect(agg.canceled).toBe(1);
    expect(agg.pending).toBe(1);
    expect(agg.decided).toBe(2);
    expect(agg.collectedUsd).toBeCloseTo(29.99);
    expect(r.data!.dailyTrials.find((d) => d.date === "2026-08-08")?.count).toBe(2);
  });

  it("returns awaiting_credentials without a key", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const r = await fetchTrialCohort("2026-08-01", "2026-08-14");
    expect(r.status).toBe("awaiting_credentials");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/connectors/__tests__/stripe-cohort.test.ts`
Expected: FAIL, `classifyTrial` is not exported.

- [ ] **Step 3: Implement in `lib/connectors/stripe.ts`** (append)

```ts
import { ADS_ASSUMPTIONS } from "@/lib/ads/config";
import type { CohortAggregates } from "@/lib/ads/economics";

export interface MinimalSub {
  status: string;
  trial_start: number | null;
  items: { data: Array<{ price?: { unit_amount: number | null } | null; quantity?: number | null }> };
}

export interface TrialRecord {
  startedAt: string;
  decided: boolean;
  outcome: "paid" | "canceled" | "past_due" | "pending";
  priceUsd: number;
}

export interface TrialCohort {
  trials: TrialRecord[];
  aggregates: CohortAggregates;
  dailyTrials: Array<{ date: string; count: number }>;
}

export function classifyTrial(sub: MinimalSub, nowSec: number, trialDays: number): TrialRecord {
  const start = sub.trial_start ?? 0;
  const windowElapsed = nowSec >= start + trialDays * 86400;
  let outcome: TrialRecord["outcome"];
  if (sub.status === "active") outcome = "paid";
  else if (sub.status === "past_due") outcome = "past_due";
  else if (sub.status === "trialing") outcome = "pending";
  else outcome = "canceled"; // canceled, incomplete_expired, unpaid
  return {
    startedAt: new Date(start * 1000).toISOString(),
    // An early cancellation decides a trial before its window elapses; a sub
    // still trialing past its window (transient, around the billing attempt)
    // also counts as decided so the boundary is stable.
    decided: windowElapsed || outcome !== "pending",
    outcome,
    priceUsd: (sub.items.data[0]?.price?.unit_amount ?? 0) / 100,
  };
}

export async function fetchTrialCohort(
  fromIso: string,
  toIso: string,
): Promise<ConnectorResult<TrialCohort>> {
  if (!hasCredentials()) return { data: null, asOf: null, status: "awaiting_credentials" };
  const gte = Math.floor(new Date(`${fromIso}T00:00:00.000Z`).getTime() / 1000);
  const lte = Math.floor(new Date(`${toIso}T23:59:59.999Z`).getTime() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  const trialDays = ADS_ASSUMPTIONS.trialDays;

  try {
    const trials: TrialRecord[] = [];
    let startingAfter: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const page = await getStripe().subscriptions.list({
        created: { gte },
        status: "all",
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const sub of page.data) {
        if (sub.trial_start == null || sub.trial_start < gte || sub.trial_start > lte) continue;
        trials.push(classifyTrial(sub as unknown as MinimalSub, nowSec, trialDays));
      }
      hasMore = page.has_more;
      startingAfter = page.data.length ? page.data[page.data.length - 1].id : undefined;
      if (!startingAfter) hasMore = false;
    }

    const aggregates: CohortAggregates = {
      trials: trials.length,
      decided: trials.filter((t) => t.decided).length,
      payers: trials.filter((t) => t.outcome === "paid").length,
      canceled: trials.filter((t) => t.outcome === "canceled").length,
      pastDue: trials.filter((t) => t.outcome === "past_due").length,
      pending: trials.filter((t) => t.outcome === "pending").length,
      collectedUsd: trials.filter((t) => t.outcome === "paid").reduce((s, t) => s + t.priceUsd, 0),
    };

    const byDate = new Map<string, number>();
    for (const t of trials) {
      const date = t.startedAt.slice(0, 10);
      byDate.set(date, (byDate.get(date) ?? 0) + 1);
    }
    const dailyTrials = [...byDate.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    return { data: { trials, aggregates, dailyTrials }, asOf: new Date().toISOString(), status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/connectors/__tests__/stripe-cohort.test.ts lib/connectors/__tests__/stripe.test.ts`
Expected: PASS, including the pre-existing stripe connector tests.

- [ ] **Step 5: Commit**

```bash
git add lib/connectors/stripe.ts lib/connectors/__tests__/stripe-cohort.test.ts
git commit -m "Add Stripe trial cohort classification for ads eval"
```

---

### Task 5: /api/ads-eval route

**Files:**
- Create: `app/api/ads-eval/route.ts`
- Create: `lib/ads/assemble.ts`
- Test: `lib/ads/__tests__/assemble.test.ts`
- Test: `app/api/ads-eval/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `fetchAdInsights`, `AdDailyRow` (Task 3); `fetchTrialCohort`, `TrialCohort` (Task 4); `deriveEconomics`, `AdsFacts` (Task 1); `runRules`, `AdRowFacts`, `AccountFunnelFacts`, `Deduction` (Task 2); `roleFromRequest` from `@/lib/session-role`; `ADS_ASSUMPTIONS`.
- Produces (the payload Task 7 renders):

```ts
// lib/ads/assemble.ts
export interface AdsEvalPayload {
  status: "ok" | "partial" | "error";
  asOf: string | null;
  windowDays: number;
  from: string;
  to: string;
  ads: AdRowFacts[];                                     // aggregated over window
  funnel: AccountFunnelFacts;
  facts: AdsFacts;                                       // account facts for deriveEconomics
  daily: Array<{ date: string; spendGbp: number; stripeTrials: number; collectedUsd: number }>;
  deductions: Deduction[];                               // server-derived with default assumptions
  assumptions: AdsAssumptions;                           // defaults for the client panel
  errors: { meta?: string; stripe?: string };
}
export function assemblePayload(args: {
  adRows: AdDailyRow[] | null;
  cohort: TrialCohort | null;
  windowDays: number;
  now: Date;
  metaError?: string;
  stripeError?: string;
}): AdsEvalPayload;
```

**Assembly rules:**
- `from`/`to`: `to` = today (UTC date of `now`), `from` = `to - (windowDays - 1)` days.
- Ads table: filter `adRows` to the window, group by `adId`, sum numerics; `ctrPct` = clicks/impressions*100 (0 when no impressions); `cpcGbp` = spend/clicks or null; `cpaGbp` = spend/pixel trials or null.
- Funnel window totals from the same filtered rows; baseline totals from ALL 30-day rows (`baselineClicks`, `baselineEmailStepViews`).
- `facts.stripeTrials` = cohort aggregate trials; `facts.trialsLast7` = cohort dailyTrials counts within the last 7 days of the window; `facts.spendGbp` = window spend total.
- `cpaSeries` for rules: per window date, spend that date / stripe trials that date (null when 0 trials).
- `daily` merges Meta daily spend with cohort daily trial counts and a naive collected estimate: `collectedUsd` on a date = payers whose trial started `trialDays` before that date... too clever; keep it simple and honest: `collectedUsd` is cumulative-agnostic per-date 0 except it carries `aggregates.collectedUsd` on the LAST date only. The chart task (Task 7) computes expected revenue client-side from economics; collected is a single number, not a series. So: `daily[].collectedUsd` is 0 for all dates except the last, which holds the cohort total. Comment this in code.
- `status`: "ok" when both sources ok, "partial" when one errored (include the other's data), "error" when both failed.
- Deductions: derive economics with default `ADS_ASSUMPTIONS`, run `runRules`, embed result.

- [ ] **Step 1: Write the failing assemble tests**

`lib/ads/__tests__/assemble.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { assemblePayload } from "@/lib/ads/assemble";
import type { AdDailyRow } from "@/lib/connectors/meta";
import type { TrialCohort } from "@/lib/connectors/stripe";

const NOW = new Date("2026-08-14T12:00:00Z");

function row(overrides: Partial<AdDailyRow> = {}): AdDailyRow {
  return {
    adId: "1", adName: "Delf 1", date: "2026-08-12", spend: 10, impressions: 500,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/ads/__tests__/assemble.test.ts`
Expected: FAIL, cannot resolve `@/lib/ads/assemble`.

- [ ] **Step 3: Implement `lib/ads/assemble.ts`**

```ts
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
      adId: r.adId, adName: r.adName, spendGbp: 0, impressions: 0, clicks: 0,
      ctrPct: 0, cpcGbp: null, contentViews: 0, emailStepViews: 0, leads: 0,
      checkouts: 0, pixelTrials: 0, cpaGbp: null,
    };
    acc.adName = r.adName || acc.adName;
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
```

- [ ] **Step 4: Run assemble tests**

Run: `npx vitest run lib/ads/__tests__/assemble.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route tests**

`app/api/ads-eval/__tests__/route.test.ts` (mirror the auth-mocking style of existing route tests in `app/api/manage/__tests__`; check that file if unsure):

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { roleFromRequest, fetchAdInsights, fetchTrialCohort } = vi.hoisted(() => ({
  roleFromRequest: vi.fn(),
  fetchAdInsights: vi.fn(),
  fetchTrialCohort: vi.fn(),
}));
vi.mock("@/lib/session-role", () => ({ roleFromRequest }));
vi.mock("@/lib/connectors/meta", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAdInsights,
}));
vi.mock("@/lib/connectors/stripe", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTrialCohort,
}));

import { GET } from "@/app/api/ads-eval/route";

function req(days = "14") {
  return new Request(`http://localhost/api/ads-eval?days=${days}`);
}

beforeEach(() => {
  roleFromRequest.mockReset();
  fetchAdInsights.mockReset();
  fetchTrialCohort.mockReset();
});

describe("/api/ads-eval auth", () => {
  it("401 for anonymous", async () => {
    roleFromRequest.mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
  });

  it("403 for non-admin", async () => {
    roleFromRequest.mockResolvedValue("marketing");
    expect((await GET(req())).status).toBe(403);
  });
});

describe("/api/ads-eval payload", () => {
  beforeEach(() => {
    roleFromRequest.mockResolvedValue("admin");
    fetchAdInsights.mockResolvedValue({ status: "ok", asOf: "x", data: [] });
    fetchTrialCohort.mockResolvedValue({
      status: "ok", asOf: "x",
      data: { trials: [], aggregates: { trials: 0, decided: 0, payers: 0, canceled: 0, pastDue: 0, pending: 0, collectedUsd: 0 }, dailyTrials: [] },
    });
  });

  it("returns an assembled payload with clamped window", async () => {
    const res = await GET(req("999"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.windowDays).toBe(30);
    expect(body.assumptions.annualPriceUsd).toBeCloseTo(29.99);
    expect(Array.isArray(body.deductions)).toBe(true);
  });

  it("marks partial when a connector errors", async () => {
    fetchAdInsights.mockResolvedValue({ status: "error", asOf: null, data: null, error: "boom" });
    const body = await (await GET(req())).json();
    expect(body.status).toBe("partial");
    expect(body.errors.meta).toBe("boom");
  });
});
```

- [ ] **Step 6: Implement `app/api/ads-eval/route.ts`**

```ts
import { NextResponse } from "next/server";
import { roleFromRequest } from "@/lib/session-role";
import { fetchAdInsights } from "@/lib/connectors/meta";
import { fetchTrialCohort } from "@/lib/connectors/stripe";
import { assemblePayload } from "@/lib/ads/assemble";

const ALLOWED_DAYS = [7, 14, 30];

export async function GET(request: Request): Promise<NextResponse> {
  const role = await roleFromRequest(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = Number(new URL(request.url).searchParams.get("days") ?? 14);
  const windowDays = ALLOWED_DAYS.includes(raw) ? raw : 30;

  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - (windowDays - 1) * 864e5).toISOString().slice(0, 10);

  const [meta, cohort] = await Promise.all([fetchAdInsights(), fetchTrialCohort(from, to)]);

  const payload = assemblePayload({
    adRows: meta.data,
    cohort: cohort.data,
    windowDays,
    now,
    metaError: meta.status === "ok" ? undefined : (meta.error ?? meta.status),
    stripeError: cohort.status === "ok" ? undefined : (cohort.error ?? cohort.status),
  });

  return NextResponse.json(payload);
}
```

Note: `ConnectorResult` has no `error` field on success; check `lib/connectors/types.ts` for the exact shape (it carries `error?: string`). Adjust property access to match.

- [ ] **Step 7: Run route tests**

Run: `npx vitest run app/api/ads-eval/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/ads/assemble.ts lib/ads/__tests__/assemble.test.ts app/api/ads-eval
git commit -m "Add ads-eval API route joining Meta and Stripe facts"
```

---

### Task 6: Funnel utm capture into lead src and checkout metadata

**Files:**
- Modify: `app/go/components/Funnel.tsx` (the `useEffect` reading `src`, and `startCheckout`)
- Modify: `app/api/checkout/route.ts`
- Test: extend `app/api/checkout/__tests__/checkout.test.ts` and `app/go/__tests__/funnel.test.tsx` (follow the existing test style in each)

**Interfaces:**
- Consumes: existing `/api/checkout` POST body `{ plan, email, fbp, fbc }`, existing lead `src` field.
- Produces: checkout body and Stripe metadata gain optional `utmCampaign`, `utmContent`; lead `src` becomes `"<src>|c:<utm_campaign>|a:<utm_content>"` when utm params are present.

**Behavior:**
- In `Funnel.tsx`, extend the mount effect: read `utm_campaign` and `utm_content` from `window.location.search`, keep them in state (`utmCampaign`, `utmContent`, default `""`). When either is present, set `src` state to the composed convention string; the existing lead POST then carries it with no further change.
- In `startCheckout`, add `utmCampaign` and `utmContent` to the POST body when non-empty.
- In `app/api/checkout/route.ts`, accept both fields, clean with the existing `cleanCookie` helper (rename it `cleanMeta` since it now covers more than cookies), and add them to BOTH `metadata` and `subscription_data.metadata` as `utm_campaign` / `utm_content`, exactly like `fbp`/`fbc`.

- [ ] **Step 1: Write the failing checkout route tests**

Add to the existing `describe("POST /api/checkout")` block in `app/api/checkout/__tests__/checkout.test.ts`. The file already mocks `stripe.checkout.sessions.create` via `vi.hoisted` and reads the call with `firstCallArgs()`; extend that helper's return type with `metadata: Record<string, string>` and `subscription_data.metadata: Record<string, string>` so these assertions typecheck:

```ts
it("passes utm fields into session and subscription metadata", async () => {
  await POST(req({
    plan: "annual",
    email: "a@b.com",
    utmCampaign: "aug-ugc",
    utmContent: "120210000001",
  }));
  const args = firstCallArgs();
  expect(args.metadata.utm_campaign).toBe("aug-ugc");
  expect(args.metadata.utm_content).toBe("120210000001");
  expect(args.subscription_data.metadata.utm_campaign).toBe("aug-ugc");
  expect(args.subscription_data.metadata.utm_content).toBe("120210000001");
});

it("omits utm keys when the fields are absent or invalid", async () => {
  await POST(req({ plan: "annual", email: "a@b.com", utmCampaign: 42 }));
  const args = firstCallArgs();
  expect(args.metadata.utm_campaign).toBeUndefined();
  expect(args.metadata.utm_content).toBeUndefined();
  expect(args.subscription_data.metadata.utm_campaign).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/api/checkout/__tests__/checkout.test.ts`
Expected: new test FAILS, existing ones PASS.

- [ ] **Step 3: Implement route + funnel changes as specified above**

- [ ] **Step 4: Add funnel test**: in `app/go/__tests__/funnel.test.tsx`, render the funnel with `?src=meta&utm_campaign=aug-ugc&utm_content=120210000001` in the URL (the existing tests show how location is stubbed), walk to checkout, and assert the `/api/checkout` fetch body includes both utm fields, and the `/api/lead` body's `src` equals `"meta|c:aug-ugc|a:120210000001"`.

- [ ] **Step 5: Run both test files**

Run: `npx vitest run app/api/checkout/__tests__/checkout.test.ts app/go/__tests__/funnel.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/go/components/Funnel.tsx app/api/checkout/route.ts app/api/checkout/__tests__ app/go/__tests__
git commit -m "Capture utm campaign and content through lead src and checkout metadata"
```

---

### Task 7: Ads eval page UI

**Files:**
- Create: `app/dashboard/ads/page.tsx`
- Create: `app/dashboard/ads/components/AdsEvalClient.tsx`
- Create: `app/dashboard/ads/components/VerdictBanner.tsx`
- Create: `app/dashboard/ads/components/AssumptionsPanel.tsx`
- Create: `app/dashboard/ads/components/CohortChart.tsx`
- Create: `app/dashboard/ads/components/AdTable.tsx`
- Create: `app/dashboard/ads/components/DeductionsPanel.tsx`
- Modify: `app/dashboard/components/DashboardClient.tsx` (header link)
- Test: `app/dashboard/ads/__tests__/adsEval.test.tsx`

**Interfaces:**
- Consumes: `AdsEvalPayload` (Task 5), `deriveEconomics` + `isModeling` + types (Task 1), `Deduction` (Task 2), `KpiTile`, `CHART_COLORS` from `@/lib/chart-theme`, brand-* Tailwind tokens.
- Produces: the finished page; no downstream consumers.

**Component contracts:**

```ts
// VerdictBanner
{ economics: DerivedEconomics; cohort: CohortAggregates; modeling: boolean }
// AssumptionsPanel
{ value: AdsAssumptions; defaults: AdsAssumptions; observedRate: number | null;
  observedN: number; onChange: (a: AdsAssumptions) => void }
// CohortChart
{ daily: AdsEvalPayload["daily"]; economics: DerivedEconomics; gbpPerUsd: number }
// AdTable
{ ads: AdRowFacts[]; deductions: Deduction[]; breakEvenCpaGbp: number }
// DeductionsPanel
{ deductions: Deduction[]; modeling: boolean }
```

**Page behavior (AdsEvalClient):**
- Fetch `/api/ads-eval?days=${days}` on mount and when `days` changes (7/14/30 segmented control, default 14).
- Hold `assumptions` state initialized from `payload.assumptions`; `modeling = isModeling(assumptions, payload.assumptions)`.
- Derive `economics = deriveEconomics(payload.facts, assumptions)` client-side every render; when modeling, ALSO recompute the economics-branch styling client-side but keep the server deductions list (label the panel with the MODELING chip; recomputing all rules client-side is out of scope, noted in the panel's context note).
- Render order: header (title, back link to /dashboard, days control), VerdictBanner, KPI tile grid, AssumptionsPanel, CohortChart, AdTable, DeductionsPanel, plus a data-freshness footer showing `asOf` and any `errors` (reuse the copy style of FreshnessLine but inline, since sources here are only Meta and Stripe).
- Partial state: when `payload.errors.meta` exists, show the ad table section replaced by an inline notice ("Meta reporting unavailable: <error>. Economics below still reflect Stripe."); mirror for stripe.

**Required context notes (copy, abbreviated here, write out fully in code):**
- Verdict: decided-trial definition, 72h Meta restatement lag, sensitivity line "at 60% cancels break-even is ~£8.50, at 40% ~£12.80" computed live from the current assumptions, not hardcoded.
- Trial-to-paid tile: "Below 15 decided trials this shows the assumed rate, not data." with `assumed`/`observed (n=X)`/`MODELING` badge.
- Chart: fixed FX constant note, expected vs collected distinction, refund caveat.
- Ad table: pixel attribution vs Stripe truth note.
- Assumptions panel: "Change these to model outcomes. Edits are not saved and do not affect any real data."
- Every GBP figure formats with `£`, USD with `$`; P&L shows sign explicitly.
- Badges on KPI tiles: pass the badge text ("assumed", "observed (n=15)", "MODELING") through KpiTile's existing `freshness` prop; no KpiTile changes needed.

**AssumptionsPanel behavior:**
- Five inputs: price USD, cancel rate (%), refund rate (%), Stripe fee (%), GBP per USD. Rendered as `<input type="number">` with `disabled` until "Edit assumptions" clicked; buttons: Edit -> Done, Reset (restores `defaults`, exits edit mode).
- Percent fields display 0-100 and store 0-1 (divide/multiply at the boundary).
- Amber "MODELING" chip on the panel when `isModeling(value, defaults)`; the same chip must appear on VerdictBanner, the economic KPI tiles, CohortChart, and DeductionsPanel via their `modeling` prop.
- Observed helper text next to cancel rate: `observed cancel rate: X% (n=Y)` when `observedRate != null`.

**CohortChart:** recharts LineChart with two lines following TrendChart's styling (import `CHART_COLORS`): cumulative spend (GBP) and cumulative expected revenue (GBP) where expected per day = (cumulative stripe trials to that day) * trialToPaid * netRevenuePerPayerUsd * gbpPerUsd; add a reference dot or third flat line for collected revenue converted to GBP on the final day. Container div, title, and context note match TrendChart's card look.

- [ ] **Step 1: Write the failing component tests**

`app/dashboard/ads/__tests__/adsEval.test.tsx` (jsdom, follow `kpi.test.tsx` style):

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VerdictBanner from "@/app/dashboard/ads/components/VerdictBanner";
import AssumptionsPanel from "@/app/dashboard/ads/components/AssumptionsPanel";
import DeductionsPanel from "@/app/dashboard/ads/components/DeductionsPanel";
import { ADS_ASSUMPTIONS } from "@/lib/ads/config";
import { deriveEconomics } from "@/lib/ads/economics";

const COHORT = { trials: 20, decided: 15, payers: 8, canceled: 7, pastDue: 0, pending: 5, collectedUsd: 239.92 };
const FACTS = { spendGbp: 200, stripeTrials: 20, trialsLast7: 12, cohort: COHORT };

describe("VerdictBanner", () => {
  it("shows verdict, evidence numbers, and learning caveat", () => {
    const econ = deriveEconomics(FACTS, ADS_ASSUMPTIONS);
    render(<VerdictBanner economics={econ} cohort={COHORT} modeling={false} />);
    expect(screen.getByText(/decided trials/i)).toBeTruthy();
    expect(screen.getByText(/learning phase/i)).toBeTruthy();
  });

  it("shows MODELING chip when modeling", () => {
    const econ = deriveEconomics(FACTS, { ...ADS_ASSUMPTIONS, assumedTrialCancelRate: 0.6 });
    render(<VerdictBanner economics={econ} cohort={COHORT} modeling={true} />);
    expect(screen.getByText("MODELING")).toBeTruthy();
  });
});

describe("AssumptionsPanel", () => {
  it("inputs are disabled until Edit is clicked, and Reset restores defaults", () => {
    const onChange = vi.fn();
    render(
      <AssumptionsPanel value={ADS_ASSUMPTIONS} defaults={ADS_ASSUMPTIONS} observedRate={7 / 15} observedN={15} onChange={onChange} />,
    );
    const price = screen.getByLabelText(/price/i) as HTMLInputElement;
    expect(price.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /edit assumptions/i }));
    expect((screen.getByLabelText(/price/i) as HTMLInputElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: "39.99" } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.lastCall![0].annualPriceUsd).toBeCloseTo(39.99);
  });

  it("shows the observed cancel rate helper", () => {
    render(
      <AssumptionsPanel value={ADS_ASSUMPTIONS} defaults={ADS_ASSUMPTIONS} observedRate={7 / 15} observedN={15} onChange={() => {}} />,
    );
    expect(screen.getByText(/observed cancel rate/i).textContent).toContain("n=15");
  });
});

describe("DeductionsPanel", () => {
  it("renders empty state when no deductions", () => {
    render(<DeductionsPanel deductions={[]} modeling={false} />);
    expect(screen.getByText(/within normal ranges/i)).toBeTruthy();
  });

  it("renders evidence and hypothesis per card", () => {
    render(
      <DeductionsPanel modeling={false} deductions={[{
        id: "change-creative", severity: "act", adId: "9",
        title: "Swap creative", evidence: "18 spent", rationale: "because", hypothesis: "it improves",
      }]} />,
    );
    expect(screen.getByText("Swap creative")).toBeTruthy();
    expect(screen.getByText(/because/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/dashboard/ads/__tests__/adsEval.test.tsx`
Expected: FAIL, components do not exist.

- [ ] **Step 3: Implement the components**

Build in this order, each as a small focused file using existing brand tokens (`bg-brand-bg-card`, `border-brand-border`, `text-brand-text`, `text-brand-text-secondary`, `text-brand-primary`, `rounded-xl`, `p-4`):

1. `VerdictBanner.tsx`: full-width card; left color bar and label per verdict (working = green tones, ambiguous = amber, broken = red; use Tailwind's emerald/amber/red utilities since brand tokens have no status colors). Body: one evidence sentence built from props, the learning-phase caveat line when `economics.learningPhase`, the MODELING chip when `modeling`, and the context note paragraph including a live sensitivity line computed from the current assumptions by calling `deriveEconomics` on 0.4/0.5/0.6 cancel-rate variants.
2. `AssumptionsPanel.tsx`: per the behavior block above; local `editing` boolean state only, all values via props.
3. `CohortChart.tsx`: per the chart block above.
4. `AdTable.tsx`: `<div className="overflow-x-auto">` wrapping a table; columns Ad, Spend, CTR, CPC, Clicks, Views, Emails, Checkouts, Trials, CPA; chip column: `swap candidate` when a change-creative deduction targets the row's adId, `top performer` for the lowest non-null CPA row, red CPA text when `cpaGbp > breakEvenCpaGbp`. Context note under the table. (The spec's per-row `learning reset <date>` chip is consciously dropped: ad-level insights carry no learning-stage info and a separate adsets call is out of today's scope; the account-level learning caveat in the VerdictBanner covers it. The spec has been annotated to match.)
5. `DeductionsPanel.tsx`: severity-ordered cards (already sorted server-side); severity chip colors urgent = red, act = amber, info = slate; empty state sentence "No deductions: current data is within normal ranges."; context note explains deductions were computed with default assumptions and modeling does not recompute them.
6. `AdsEvalClient.tsx`: per the page-behavior block above; fetch pattern copied from DashboardClient (cancelled flag in useEffect).
7. `page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import AdsEvalClient from "./components/AdsEvalClient";

export default async function AdsEvalPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");
  return <AdsEvalClient />;
}
```

Check `app/dashboard/page.tsx` first: it imports `verifySession` from `@/lib/session`, while `session-role.ts` imports from `@/lib/auth`. Use whichever module the dashboard page actually uses so the import resolves.

8. In `DashboardClient.tsx`, inside the header's right-side flex div, before the sign-out button, add for admins only:

```tsx
{role === "admin" ? (
  <a href="/dashboard/ads" className="text-sm text-brand-primary hover:underline">
    Ads eval
  </a>
) : null}
```

- [ ] **Step 4: Run the component tests**

Run: `npx vitest run app/dashboard/ads/__tests__/adsEval.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite, lint, and build**

```bash
npx vitest run
npm run lint
npm run build
```
Expected: all pass. Fix anything that does not.

- [ ] **Step 6: Manual smoke check**

Run `npm run dev`, log in as admin, open `/dashboard/ads`: verify the page renders with live or partial data, the days control refetches, Edit assumptions -> change cancel rate to 60 -> MODELING chips appear and break-even drops, Reset restores. Verify non-admin (marketing role) is redirected to /dashboard.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/ads app/dashboard/components/DashboardClient.tsx
git commit -m "Add admin ads eval dashboard with scenario modeling"
```

---

### Task 8: Finish

- [ ] **Step 1: Re-run everything**

```bash
npx vitest run && npm run lint && npm run build
```
Expected: clean.

- [ ] **Step 2: Push branch and open PR to main**

```bash
git push -u origin ads-eval-dashboard
gh pr create --title "Admin ads eval dashboard" --body "Adds /dashboard/ads: verdict banner, KPI tiles, cohort chart, per-ad table, deterministic deductions, editable what-if assumptions. Joins Meta ad-level insights with Stripe trial cohorts. Spec: docs/superpowers/specs/2026-08-14-ads-eval-dashboard-design.md"
```

No commit attribution trailers of any kind.
