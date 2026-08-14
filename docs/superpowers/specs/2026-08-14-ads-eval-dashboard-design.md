# Ads Eval Dashboard - Design

Date: 2026-08-14
Status: approved (this doc reflects the approved design plus two additions: per-panel context notes, and explicit trial-cancellation assumptions in the break-even model)

## Purpose

A new admin-only view at `/dashboard/ads` that answers two questions on one screen:

1. Is the ad spend gamble working? (cohort economics: CPA vs break-even, trial-to-paid, projected P&L)
2. What should we change next? (per-ad performance plus a deterministic rules engine that emits "deductions": change creative, shorten onboarding, try app trial instead of web, etc.)

No LLM or external AI API anywhere. The analysis rules are an abstraction of the meta-ads-analyzer skill's methodology (MIT), re-implemented as pure TypeScript.

## Where it lives

- Page: `app/dashboard/ads/page.tsx`, session-gated exactly like `/dashboard`, and additionally requires `role === "admin"` (same gate as the MRR/ARR tiles). Non-admins get redirected to `/dashboard`.
- Link from the main dashboard header ("Ads eval"), admin-only.
- Date range: defaults to last 14 days; presets 7 / 14 / 30 days. Not the month picker: cohort logic wants a rolling window.

## Assumptions model (single source of truth)

`lib/ads/config.ts` exports one `ADS_ASSUMPTIONS` object used by every panel:

```ts
{
  annualPriceUsd: 29.99,          // from FUNNEL_CONFIG
  trialDays: 3,                   // from FUNNEL_CONFIG
  assumedTrialCancelRate: 0.5,    // share of decided trials that cancel before billing
  minDecidedForActuals: 15,       // below this, show assumed rate with an "assumed" badge
  stripeFeeRate: 0.03,
  refundRate: 0.05,               // assumed until we observe real refunds
  gbpPerUsd: 0.77,                // manual constant; spend is GBP, revenue USD
}
```

Derived values (computed, never hardcoded elsewhere):

- `trialToPaid = 1 - cancelRate` (assumed or actual, per the switch rule below)
- `netRevenuePerPayerUsd = annualPriceUsd * (1 - stripeFeeRate) * (1 - refundRate)`
- `breakEvenCpaGbp = netRevenuePerPayerUsd * trialToPaid * gbpPerUsd`

Switch rule: while decided trials in the window `< minDecidedForActuals`, all economics use `assumedTrialCancelRate` and every figure derived from it carries an "assumed" badge. At or above the threshold, the observed cancel rate from Stripe replaces the assumption and badges flip to "observed (n=X)".

### Scenario modeling (editable assumptions)

An "Assumptions" panel renders the config values as a row of input boxes: price (USD), cancel rate, refund rate, Stripe fee rate, GBP/USD rate. Behavior:

- Read-only by default. An "Edit assumptions" button unlocks all fields at once; "Done" locks them again, "Reset" restores defaults.
- Edits are client-side state only: nothing persists, a reload restores defaults. No API round-trip; see Data plumbing (derivation moves client-side to make this instant).
- While any value differs from its default (or from the observed rate when actuals are active), the page enters modeling mode: an amber "MODELING" chip appears on the assumptions panel and on every derived figure (verdict banner, economic KPI tiles, cohort chart, economics deduction), so a modeled outcome can never be mistaken for reality.
- The observed cancel rate, when available, is shown next to the input as "observed: X% (n=Y)"; editing the input models an override of it.
- Raw facts never change with edits: spend, trials, CTR, funnel counts, payers, and collected revenue are immune; only derived economics (break-even, trial-to-paid when assumed/overridden, expected revenue, projected P&L, verdict) re-derive.
- Context note on the panel: "Change these to model outcomes, e.g. what happens to break-even if cancellations run at 60%, or if we price at 39.99. Edits are not saved and do not affect any real data."

Sensitivity (shown in the verdict panel's context note so the target is legible):

| Cancel rate | Trial-to-paid | Break-even CPA (GBP) |
|---|---|---|
| 60% | 40% | ~8.50 |
| 50% | 50% | ~10.60 |
| 40% | 60% | ~12.80 |

## Page layout

Every panel has a context note in the same style as the existing dashboard tiles (plain-language description including data lag, source, and assumptions in play).

### 1. Verdict banner

Traffic-light strip: WORKING / AMBIGUOUS / BROKEN, with evidence inline, e.g. "17 decided trials, 8 payers (47% observed trial-to-paid), CPA 10.80 vs 10.60 break-even".

- WORKING: CPA <= break-even AND (trial-to-paid >= 40% or still assumed)
- BROKEN: >= 15 decided trials AND payers <= 1, OR observed trial-to-paid < 20%
- AMBIGUOUS: everything else (e.g. CPA above break-even but payers exist)
- Learning-phase caveat: while trials in the last 7 days < 50, the banner shows "preliminary: ad set still in learning phase" and the verdict copy is softened.

Context note: explains "decided" (trial older than trialDays, classified by what Stripe shows now), that Meta conversion counts can restate for up to ~72h under 7-day-click attribution, and states the current break-even with the cancel-rate sensitivity table above ("if cancellations run at 60% instead of 50%, break-even drops to ~8.50; the verdict thresholds move with it").

### 2. KPI tiles (reuse `KpiTile`)

Spend (GBP), Trial starts, CPA, Decided trials, Trial-to-paid (badge: assumed/observed), Payers, Revenue collected (USD), Projected cohort P&L (GBP, = expected total revenue from all trials in window minus spend).

Context notes per tile, e.g.:
- Spend: "From Meta's reporting API; can lag a few hours."
- Trial-to-paid: "Share of decided trials that paid. Below 15 decided trials this shows our 50% assumption, not data."
- Projected P&L: "Counts pending trials at the current trial-to-paid rate; a swing in cancellation rate moves this directly (see verdict note)."

### 3. Cohort chart (reuse `TrendChart`)

Cumulative spend vs cumulative revenue (collected + expected from pending trials) by day, with the break-even trajectory. Context note: revenue is USD converted at the fixed rate in config; expected revenue is an estimate, not booked money; refunds inside 14 days can pull collected revenue back down.

### 4. Per-ad table

One row per ad (active or with spend in window): spend, impressions, CTR, CPC, funnel columns (link clicks -> content views -> leads -> checkouts started -> trials), CPA, flags (chips): `swap candidate`, `top performer`. (Amended at planning: the per-row `learning reset <date>` chip is dropped for v1; ad-level insights carry no learning-stage info, and the account-level learning-phase caveat in the verdict banner covers the same risk.)

Context note: funnel columns are Meta pixel events attributed per ad by Meta (7-day click / 1-day view), so they restate for ~72h and will not exactly match Stripe or the leads table; trials here are pixel-attributed, the economics panels use Stripe truth.

### 5. Deductions panel

Cards emitted by the rules engine, each with: title (the action), evidence (numbers that triggered it), rationale (one sentence of mechanism), and a "hypothesis to test" framing. Ordered by severity. Empty state: "No deductions: current data is within normal ranges."

## Rules engine

`lib/ads/rules.ts`: pure function `(input: AdsEvalData) => Deduction[]`. No I/O. Each rule has an id, trigger, and templated evidence/recommendation.

Launch rules:

1. `change-creative` (per ad): spend >= 1.5x current CPA AND CTR < 1% AND 0 pixel trials -> "Swap this creative for one in the wings."
2. `shorten-onboarding` (account): CTR healthy (>= 1.5%) but clicks -> email-step rate < 60% of the trailing-30-day baseline -> "Visitors bail between click and email gate; test fewer quiz steps."
3. `app-trial-instead-of-web` (account): leads -> checkout-start healthy but checkout-start -> trial < 50% -> "Friction is at payment entry; test routing to the app store trial instead of web checkout."
4. `economics-branch` (account): mirrors the verdict banner with the agreed action per branch (hold 50/day; stop; stretch budget for a definitive read).
5. `normal-fluctuation-guard` (account): if day-over-day CPA swing < 30% and 7-day trend flat, suppress urgency wording on other deductions and emit "No action: current swings are normal delivery variance."
6. Breakdown-effect guard (cross-cutting): no rule may recommend pausing a segment on higher average CPA alone; recommendation copy is always a testable hypothesis.

Thresholds live next to the rules as named constants with comments; they are heuristics, not laws.

## Data plumbing

- `lib/connectors/meta.ts`: add `fetchAdInsights(from, to)`: `level=ad`, `time_increment=1`, fields spend/impressions/clicks/ctr/cpc/actions, filtered to the pixel events (ViewContent, Lead custom events, InitiateCheckout, start_trial_website). Same cache layer, 1h TTL for current window.
- `lib/connectors/stripe.ts`: add `fetchTrialCohort(from, to)`: subscriptions with `trial_start` in window -> per-trial record { started, decided, outcome: paid | canceled | past_due | pending }, plus aggregates. Decided = trial_start + trialDays in the past.
- New route `app/api/ads-eval/route.ts`: session + admin check, joins Meta + Stripe, runs the rules engine, returns one JSON payload of raw facts (per-ad metrics, funnel counts, trial cohort aggregates, deductions) plus the default assumptions. It does NOT bake derived economics into the payload.
- Derivation layer `lib/ads/economics.ts`: pure functions `(facts, assumptions) => derived` (break-even, trial-to-paid, expected revenue, projected P&L, verdict). The page calls it client-side with the current assumptions state, so scenario edits re-derive instantly with no refetch. The verdict inside the deductions payload is computed server-side with default assumptions; in modeling mode the client recomputes it and labels it MODELING.
- Funnel change: `/go` reads `utm_campaign`, `utm_content` (ad id) from the landing URL, stores on the lead (`src` field convention) and passes through checkout metadata alongside fbp/fbc. Blended attribution stays the analysis basis for now; this is future-proofing only.

## Currency

Meta spend is GBP; Stripe revenue is USD. All economics normalize to GBP via the fixed `gbpPerUsd` constant. Every panel showing mixed-currency math says so in its context note. No FX API (YAGNI).

## Testing

Vitest, following existing patterns in `__tests__` folders:

- Rules engine: table-driven cases per rule (trigger fires / doesn't / suppression interaction).
- Trial cohort classifier: decided/pending boundaries, each outcome mapping, window edges.
- Break-even derivation: assumed vs observed switch at exactly `minDecidedForActuals`.
- Economics derivation: same facts re-derived under edited assumptions (price, cancel rate, FX) produce correct break-even/P&L/verdict; modeling flag set only when values differ from defaults/observed.
- Route: auth (401 anon, 403 non-admin), happy-path shape, connector-error partial response.

## Out of scope

LLM/MCP at runtime; per-campaign revenue join (IDs captured, not joined); TikTok; write operations against Meta; historical persistence beyond existing cache; auction-overlap rules (single ad set); FX API.
