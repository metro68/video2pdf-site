# Web Cancellation Retention Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-click Stripe-portal cancellation with a site-owned 4-step retention flow (reason survey, loss screen, plan-branched save offer, confirm), per the spec at `docs/superpowers/specs/2026-07-29-cancel-retention-flow-design.md`.

**Architecture:** New `lib/manage/` modules (signed token, overview mapping, Stripe operations) behind new `/api/manage/*` routes; `/manage` becomes lookup + overview, `/manage/cancel` hosts a client wizard that hands off state via sessionStorage. Entitlement stays webhook-driven and untouched: cancel uses `cancel_at_period_end`, the weekly pause uses `pause_collection` (status stays `active`), the annual offer is a one-time $29-off coupon.

**Tech Stack:** Next.js 15 app router, TypeScript strict, Stripe SDK (pinned `2026-06-24.dahlia`), `jose` JWTs, Postgres via `lib/db/client.ts` tagged `sql`, vitest + @testing-library/react (jsdom, globals: true).

## Global Constraints

- No em dashes in any text: code, comments, UI copy, commit messages. Use commas, colons, or parentheses.
- TypeScript strict; no `any` without a comment explaining why (existing Stripe payload mapping uses commented `any`, follow that pattern).
- Absolute imports via `@/` alias.
- Run `npm run lint` before pushing.
- Every wizard screen must render a working "Continue to cancel" path (legal requirement, tested).
- No new env vars: reuse `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_WEEKLY`, `STRIPE_PRICE_ANNUAL`, `POSTGRES_URL`.
- Webhook (`lib/stripe/webhook.ts`) and its tests must remain untouched and green.
- All commits on `main` in `video2pdf-site` (repo works off main), commit messages without attribution trailers.
- Repo test command: `npx vitest run <path>` for one file, `npm test` for all.

---

### Task 1: cancellation_events table and DB helper

**Files:**
- Modify: `lib/db/schema.sql`
- Create: `lib/db/cancellationEvents.ts`
- Test: `lib/db/__tests__/cancellationEvents.test.ts`

**Interfaces:**
- Consumes: `sql` from `@/lib/db/client`, `Plan` type from `@/lib/db/client`.
- Produces: `insertCancellationEvent(input: CancellationEventInput): Promise<void>` and the types `CancellationEventInput`, `CancelStep`, `CancelOutcome` used by Tasks 5 and 6.

- [ ] **Step 1: Write the failing test**

Mirror the mocking style of `lib/db/__tests__/subscriptions.test.ts` (mock `@/lib/db/client`).

```ts
// lib/db/__tests__/cancellationEvents.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const sqlMock = vi.fn().mockResolvedValue({ rows: [] });
vi.mock("@/lib/db/client", () => ({
  sql: (...args: unknown[]) => sqlMock(...args),
}));

import { insertCancellationEvent } from "@/lib/db/cancellationEvents";

describe("insertCancellationEvent", () => {
  beforeEach(() => sqlMock.mockClear());

  it("inserts a row with all fields", async () => {
    await insertCancellationEvent({
      email: "User@Example.com ",
      plan: "annual",
      reason: "too_expensive",
      comment: "hi",
      stepReached: "offer",
      outcome: "saved_offer",
    });
    expect(sqlMock).toHaveBeenCalledTimes(1);
    const values = sqlMock.mock.calls[0].slice(1);
    expect(values).toContain("user@example.com");
    expect(values).toContain("saved_offer");
  });

  it("defaults reason, comment and outcome to null", async () => {
    await insertCancellationEvent({
      email: "a@b.c",
      plan: "weekly",
      stepReached: "survey",
    });
    const values = sqlMock.mock.calls[0].slice(1);
    expect(values).toContain(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/__tests__/cancellationEvents.test.ts`
Expected: FAIL, cannot resolve `@/lib/db/cancellationEvents`.

- [ ] **Step 3: Add the table to schema.sql**

Append to `lib/db/schema.sql` (idempotent, matching the file's existing style, and RLS like the other tables):

```sql
CREATE TABLE IF NOT EXISTS cancellation_events (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('weekly','annual')),
  reason TEXT,
  comment TEXT,
  step_reached TEXT NOT NULL CHECK (step_reached IN ('survey','loss','offer','confirm')),
  outcome TEXT CHECK (outcome IN ('saved_offer','paused','canceled','resumed','abandoned_kept')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_events_email ON cancellation_events(email);

ALTER TABLE cancellation_events ENABLE ROW LEVEL SECURITY;
```

No foreign key to `subscriptions`: feedback must land even if the webhook has not created the row yet.

- [ ] **Step 4: Write the helper**

```ts
// lib/db/cancellationEvents.ts
import { sql, type Plan } from "./client";

export type CancelStep = "survey" | "loss" | "offer" | "confirm";
export type CancelOutcome =
  | "saved_offer"
  | "paused"
  | "canceled"
  | "resumed"
  | "abandoned_kept";

export interface CancellationEventInput {
  email: string;
  plan: Plan;
  reason?: string | null;
  comment?: string | null;
  stepReached: CancelStep;
  outcome?: CancelOutcome | null;
}

export async function insertCancellationEvent(
  input: CancellationEventInput,
): Promise<void> {
  await sql`
    INSERT INTO cancellation_events (email, plan, reason, comment, step_reached, outcome)
    VALUES (${input.email.trim().toLowerCase()}, ${input.plan}, ${input.reason ?? null},
            ${input.comment ?? null}, ${input.stepReached}, ${input.outcome ?? null})
  `;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/db/__tests__/cancellationEvents.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.sql lib/db/cancellationEvents.ts lib/db/__tests__/cancellationEvents.test.ts
git commit -m "Add cancellation_events table and insert helper"
```

---

### Task 2: signed manage token

**Files:**
- Create: `lib/manage/token.ts`
- Test: `lib/manage/__tests__/token.test.ts`

**Interfaces:**
- Consumes: `jose` (already a dependency, used by `lib/session.ts`), `JWT_SECRET` env.
- Produces: `signManageToken(p: ManageTokenPayload): Promise<string>`, `verifyManageToken(token: string): Promise<ManageTokenPayload | null>`, `interface ManageTokenPayload { subscriptionId: string; email: string }`. Used by Tasks 3, 5, 6.

The token carries a `scope: "manage"` claim so a dashboard session JWT (signed with the same `JWT_SECRET` by `lib/session.ts`) can never be replayed against manage endpoints, and vice versa (dashboard verify requires a `role` claim these tokens do not have).

- [ ] **Step 1: Write the failing test**

```ts
// lib/manage/__tests__/token.test.ts
import { describe, expect, it, beforeAll } from "vitest";
import { SignJWT } from "jose";
import { signManageToken, verifyManageToken } from "@/lib/manage/token";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

describe("manage token", () => {
  it("round-trips subscriptionId and email", async () => {
    const token = await signManageToken({ subscriptionId: "sub_1", email: "a@b.c" });
    expect(await verifyManageToken(token)).toEqual({
      subscriptionId: "sub_1",
      email: "a@b.c",
    });
  });

  it("rejects a tampered token", async () => {
    const token = await signManageToken({ subscriptionId: "sub_1", email: "a@b.c" });
    expect(await verifyManageToken(token.slice(0, -2) + "xx")).toBeNull();
  });

  it("rejects a JWT without the manage scope", async () => {
    const rogue = await new SignJWT({ email: "a@b.c", role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30m")
      .sign(new TextEncoder().encode("test-secret"));
    expect(await verifyManageToken(rogue)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ subscriptionId: "sub_1", email: "a@b.c", scope: "manage" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode("test-secret"));
    expect(await verifyManageToken(expired)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/manage/__tests__/token.test.ts`
Expected: FAIL, cannot resolve `@/lib/manage/token`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/manage/token.ts
import { SignJWT, jwtVerify } from "jose";

// Short-lived token binding the /manage flow to one subscription. Signed with the
// same JWT_SECRET as dashboard sessions but carries scope:"manage" (and no role),
// so the two token kinds are mutually unusable.

export interface ManageTokenPayload {
  subscriptionId: string;
  email: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signManageToken(p: ManageTokenPayload): Promise<string> {
  return new SignJWT({ subscriptionId: p.subscriptionId, email: p.email, scope: "manage" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(secretKey());
}

export async function verifyManageToken(
  token: string,
): Promise<ManageTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.scope !== "manage") return null;
    if (typeof payload.subscriptionId !== "string") return null;
    if (typeof payload.email !== "string") return null;
    return { subscriptionId: payload.subscriptionId, email: payload.email };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/manage/__tests__/token.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/manage/token.ts lib/manage/__tests__/token.test.ts
git commit -m "Add signed manage token for cancel flow endpoints"
```

---

### Task 3: manage config, overview mapping, and subscription picking

**Files:**
- Create: `lib/manage/config.ts`
- Create: `lib/manage/overview.ts`
- Test: `lib/manage/__tests__/overview.test.ts`

**Interfaces:**
- Consumes: `Plan` from `@/lib/db/client`, `FUNNEL_CONFIG` from `@/lib/funnel/config`.
- Produces (used by Tasks 4, 5, 6, 8, 9):
  - `MANAGE_CONFIG` with `offerToTrialing: boolean`, `winbackCouponId: string`, `winbackAmountOffCents: number`, `pauseDays: number`, `cancelReasons` array.
  - `interface ManageOverview { plan: Plan; priceLabel: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number | null; trialing: boolean; pastDue: boolean; winbackRedeemed: boolean; pauseRedeemed: boolean; offerAvailable: boolean }`
  - `pickRelevantSubscription(subs: StripeSubLike[]): StripeSubLike | null`
  - `mapSubscriptionToOverview(sub: StripeSubLike, priceToPlan: Record<string, Plan>): ManageOverview | null`

- [ ] **Step 1: Write config.ts (no test needed, pure constants)**

```ts
// lib/manage/config.ts
export const MANAGE_CONFIG = {
  // Trialing annual subscribers get the $0.99 offer too (their first paid year
  // becomes $0.99). Flip to false if redemption data shows trial gaming.
  offerToTrialing: true,
  winbackCouponId: "winback-annual-29",
  winbackAmountOffCents: 2900,
  pauseDays: 30,
  cancelReasons: [
    { id: "too_expensive", label: "Too expensive" },
    { id: "not_using", label: "Not using it enough" },
    { id: "missing_feature", label: "Missing a feature I need" },
    { id: "not_working", label: "Something's not working" },
    { id: "finished", label: "I finished what I needed it for" },
  ],
} as const;

export type CancelReasonId =
  | (typeof MANAGE_CONFIG.cancelReasons)[number]["id"]
  | "skipped";
```

- [ ] **Step 2: Write the failing tests for overview mapping**

```ts
// lib/manage/__tests__/overview.test.ts
import { describe, expect, it } from "vitest";
import {
  mapSubscriptionToOverview,
  pickRelevantSubscription,
  type StripeSubLike,
} from "@/lib/manage/overview";

const PRICE_TO_PLAN = { price_w: "weekly", price_a: "annual" } as const;

function sub(over: Partial<StripeSubLike> = {}): StripeSubLike {
  return {
    id: "sub_1",
    status: "active",
    cancel_at_period_end: false,
    created: 100,
    metadata: {},
    items: { data: [{ price: { id: "price_a" }, current_period_end: 1_800_000_000 }] },
    ...over,
  };
}

describe("mapSubscriptionToOverview", () => {
  it("maps an active annual subscription with the offer available", () => {
    const o = mapSubscriptionToOverview(sub(), PRICE_TO_PLAN);
    expect(o).toMatchObject({
      plan: "annual",
      priceLabel: "$29.99",
      trialing: false,
      pastDue: false,
      winbackRedeemed: false,
      pauseRedeemed: false,
      offerAvailable: true,
      currentPeriodEnd: 1_800_000_000_000,
    });
  });

  it("reads redemption flags from metadata and withdraws the offer", () => {
    const o = mapSubscriptionToOverview(
      sub({ metadata: { winback_redeemed: "1" } }),
      PRICE_TO_PLAN,
    );
    expect(o?.winbackRedeemed).toBe(true);
    expect(o?.offerAvailable).toBe(false);
  });

  it("withdraws the offer for past_due", () => {
    const o = mapSubscriptionToOverview(sub({ status: "past_due" }), PRICE_TO_PLAN);
    expect(o?.pastDue).toBe(true);
    expect(o?.offerAvailable).toBe(false);
  });

  it("keeps the offer for trialing when offerToTrialing is true", () => {
    const o = mapSubscriptionToOverview(sub({ status: "trialing" }), PRICE_TO_PLAN);
    expect(o?.trialing).toBe(true);
    expect(o?.offerAvailable).toBe(true);
  });

  it("maps weekly via its price id and pause_redeemed flag", () => {
    const o = mapSubscriptionToOverview(
      sub({
        items: { data: [{ price: { id: "price_w" }, current_period_end: 1_800_000_000 }] },
        metadata: { pause_redeemed: "1" },
      }),
      PRICE_TO_PLAN,
    );
    expect(o?.plan).toBe("weekly");
    expect(o?.offerAvailable).toBe(false);
  });

  it("returns null for an unknown price id", () => {
    const o = mapSubscriptionToOverview(
      sub({ items: { data: [{ price: { id: "price_x" }, current_period_end: 1 }] } }),
      PRICE_TO_PLAN,
    );
    expect(o).toBeNull();
  });
});

describe("pickRelevantSubscription", () => {
  it("prefers a live subscription over a canceled one", () => {
    const canceled = sub({ id: "sub_old", status: "canceled", created: 200 });
    const live = sub({ id: "sub_live", created: 50 });
    expect(pickRelevantSubscription([canceled, live])?.id).toBe("sub_live");
  });

  it("picks the newest live subscription", () => {
    const a = sub({ id: "sub_a", created: 100 });
    const b = sub({ id: "sub_b", created: 300 });
    expect(pickRelevantSubscription([a, b])?.id).toBe("sub_b");
  });

  it("returns null when everything is canceled", () => {
    expect(pickRelevantSubscription([sub({ status: "canceled" })])).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/manage/__tests__/overview.test.ts`
Expected: FAIL, cannot resolve `@/lib/manage/overview`.

- [ ] **Step 4: Write overview.ts**

```ts
// lib/manage/overview.ts
import type { Plan } from "@/lib/db/client";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";
import { MANAGE_CONFIG } from "./config";

// Minimal shape of a Stripe subscription as this module reads it. The pinned
// Stripe apiVersion moved current_period_end onto the subscription items
// (see lib/stripe/webhook.ts for the same handling).
export interface StripeSubLike {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  created: number;
  metadata: Record<string, string>;
  items: { data: Array<{ price: { id: string }; current_period_end?: number }> };
}

export interface ManageOverview {
  plan: Plan;
  priceLabel: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  trialing: boolean;
  pastDue: boolean;
  winbackRedeemed: boolean;
  pauseRedeemed: boolean;
  offerAvailable: boolean;
}

const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

export function pickRelevantSubscription(
  subs: StripeSubLike[],
): StripeSubLike | null {
  const live = subs.filter((s) => LIVE_STATUSES.has(s.status));
  if (live.length === 0) return null;
  return live.sort((a, b) => b.created - a.created)[0];
}

export function mapSubscriptionToOverview(
  sub: StripeSubLike,
  priceToPlan: Record<string, Plan>,
): ManageOverview | null {
  const priceId = sub.items?.data?.[0]?.price?.id;
  const plan = priceId ? priceToPlan[priceId] : undefined;
  if (!plan) return null;

  const trialing = sub.status === "trialing";
  const pastDue = sub.status === "past_due" || sub.status === "unpaid";
  const winbackRedeemed = sub.metadata?.winback_redeemed === "1";
  const pauseRedeemed = sub.metadata?.pause_redeemed === "1";
  const redeemed = plan === "annual" ? winbackRedeemed : pauseRedeemed;
  const offerAvailable =
    !redeemed && !pastDue && (!trialing || MANAGE_CONFIG.offerToTrialing);

  const periodEndSec = sub.items?.data?.[0]?.current_period_end;

  return {
    plan,
    priceLabel: FUNNEL_CONFIG.plans[plan].price,
    status: sub.status,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    currentPeriodEnd: typeof periodEndSec === "number" ? periodEndSec * 1000 : null,
    trialing,
    pastDue,
    winbackRedeemed,
    pauseRedeemed,
    offerAvailable,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/manage/__tests__/overview.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/manage/config.ts lib/manage/overview.ts lib/manage/__tests__/overview.test.ts
git commit -m "Add manage config and subscription overview mapping"
```

---

### Task 4: lookup endpoint

**Files:**
- Create: `app/api/manage/lookup/route.ts`
- Test: `app/api/manage/__tests__/lookup.test.ts`

**Interfaces:**
- Consumes: `stripe` from `@/lib/stripe/client`, `PRICE_TO_PLAN` from `@/lib/stripe/client`, `signManageToken` (Task 2), `pickRelevantSubscription` / `mapSubscriptionToOverview` (Task 3).
- Produces: `POST /api/manage/lookup` with body `{ email: string }` returning `{ token: string, overview: ManageOverview }` or `404 { error: "No subscription found for that email" }`. The client (Tasks 8, 9) relies on this exact response shape.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/manage/__tests__/lookup.test.ts
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

const customersList = vi.fn();
const subscriptionsList = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    customers: { list: (...a: unknown[]) => customersList(...a) },
    subscriptions: { list: (...a: unknown[]) => subscriptionsList(...a) },
  },
  PRICE_TO_PLAN: { price_a: "annual", price_w: "weekly" },
}));

import { POST } from "@/app/api/manage/lookup/route";
import { verifyManageToken } from "@/lib/manage/token";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

function req(body: unknown): Request {
  return new Request("http://test/api/manage/lookup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const liveSub = {
  id: "sub_1",
  status: "active",
  cancel_at_period_end: false,
  created: 100,
  metadata: {},
  items: { data: [{ price: { id: "price_a" }, current_period_end: 1_800_000_000 }] },
};

describe("POST /api/manage/lookup", () => {
  beforeEach(() => {
    customersList.mockReset();
    subscriptionsList.mockReset();
  });

  it("400s without an email", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });

  it("404s when no customer exists", async () => {
    customersList.mockResolvedValue({ data: [] });
    expect((await POST(req({ email: "a@b.c" }))).status).toBe(404);
  });

  it("404s when the customer has no live subscription", async () => {
    customersList.mockResolvedValue({ data: [{ id: "cus_1" }] });
    subscriptionsList.mockResolvedValue({ data: [{ ...liveSub, status: "canceled" }] });
    expect((await POST(req({ email: "a@b.c" }))).status).toBe(404);
  });

  it("returns an overview and a valid manage token", async () => {
    customersList.mockResolvedValue({ data: [{ id: "cus_1" }] });
    subscriptionsList.mockResolvedValue({ data: [liveSub] });
    const res = await POST(req({ email: "A@B.c " }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overview.plan).toBe("annual");
    expect(await verifyManageToken(body.token)).toEqual({
      subscriptionId: "sub_1",
      email: "a@b.c",
    });
    expect(customersList).toHaveBeenCalledWith({ email: "a@b.c", limit: 1 });
    expect(subscriptionsList).toHaveBeenCalledWith({
      customer: "cus_1",
      status: "all",
      limit: 10,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/manage/__tests__/lookup.test.ts`
Expected: FAIL, cannot resolve the route module.

- [ ] **Step 3: Write the route**

```ts
// app/api/manage/lookup/route.ts
import { NextResponse } from "next/server";
import { stripe, PRICE_TO_PLAN } from "@/lib/stripe/client";
import { signManageToken } from "@/lib/manage/token";
import {
  mapSubscriptionToOverview,
  pickRelevantSubscription,
  type StripeSubLike,
} from "@/lib/manage/overview";

export async function POST(request: Request): Promise<NextResponse> {
  const { email } = await request.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();

  try {
    const customers = await stripe.customers.list({ email: normalized, limit: 1 });
    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: "No subscription found for that email" },
        { status: 404 },
      );
    }

    const subs = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: "all",
      limit: 10,
    });
    // Stripe's typed Subscription is wider than the minimal shape we read; the
    // pinned apiVersion keeps current_period_end on the items (see webhook.ts).
    const picked = pickRelevantSubscription(subs.data as unknown as StripeSubLike[]);
    const overview = picked ? mapSubscriptionToOverview(picked, PRICE_TO_PLAN) : null;
    if (!picked || !overview) {
      return NextResponse.json(
        { error: "No subscription found for that email" },
        { status: 404 },
      );
    }

    const token = await signManageToken({ subscriptionId: picked.id, email: normalized });
    return NextResponse.json({ token, overview });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/manage/__tests__/lookup.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/manage/lookup/route.ts app/api/manage/__tests__/lookup.test.ts
git commit -m "Add manage lookup endpoint returning overview and signed token"
```

---

### Task 5: Stripe operations module (coupon, pause, cancel, resume, portal configs)

**Files:**
- Create: `lib/manage/stripeOps.ts`
- Test: `lib/manage/__tests__/stripeOps.test.ts`

**Interfaces:**
- Consumes: `stripe` from `@/lib/stripe/client`, `MANAGE_CONFIG` (Task 3).
- Produces (used by Task 6):
  - `ensureWinbackCoupon(): Promise<string>` (returns coupon id)
  - `applyAnnualWinback(subscriptionId: string): Promise<void>`
  - `applyWeeklyPause(subscriptionId: string, resumesAtSec: number): Promise<void>`
  - `setCancelAtPeriodEnd(subscriptionId: string, value: boolean): Promise<void>`
  - `ensurePortalConfiguration(allowCancel: boolean): Promise<string>` (returns configuration id)

- [ ] **Step 1: Write the failing test**

```ts
// lib/manage/__tests__/stripeOps.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const couponsRetrieve = vi.fn();
const couponsCreate = vi.fn();
const subsUpdate = vi.fn();
const portalConfigList = vi.fn();
const portalConfigCreate = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    coupons: {
      retrieve: (...a: unknown[]) => couponsRetrieve(...a),
      create: (...a: unknown[]) => couponsCreate(...a),
    },
    subscriptions: { update: (...a: unknown[]) => subsUpdate(...a) },
    billingPortal: {
      configurations: {
        list: (...a: unknown[]) => portalConfigList(...a),
        create: (...a: unknown[]) => portalConfigCreate(...a),
      },
    },
  },
}));

import {
  ensureWinbackCoupon,
  applyAnnualWinback,
  applyWeeklyPause,
  setCancelAtPeriodEnd,
  ensurePortalConfiguration,
} from "@/lib/manage/stripeOps";

beforeEach(() => {
  couponsRetrieve.mockReset();
  couponsCreate.mockReset();
  subsUpdate.mockReset().mockResolvedValue({});
  portalConfigList.mockReset();
  portalConfigCreate.mockReset();
});

describe("ensureWinbackCoupon", () => {
  it("returns the existing coupon without creating", async () => {
    couponsRetrieve.mockResolvedValue({ id: "winback-annual-29" });
    expect(await ensureWinbackCoupon()).toBe("winback-annual-29");
    expect(couponsCreate).not.toHaveBeenCalled();
  });

  it("creates the coupon when missing", async () => {
    couponsRetrieve.mockRejectedValue({ code: "resource_missing" });
    couponsCreate.mockResolvedValue({ id: "winback-annual-29" });
    expect(await ensureWinbackCoupon()).toBe("winback-annual-29");
    expect(couponsCreate).toHaveBeenCalledWith({
      id: "winback-annual-29",
      amount_off: 2900,
      currency: "usd",
      duration: "once",
      name: "Winback: next year $0.99",
    });
  });
});

describe("offer and cancel operations", () => {
  it("applies the annual winback coupon and flags redemption in one update", async () => {
    couponsRetrieve.mockResolvedValue({ id: "winback-annual-29" });
    await applyAnnualWinback("sub_1");
    expect(subsUpdate).toHaveBeenCalledWith("sub_1", {
      discounts: [{ coupon: "winback-annual-29" }],
      metadata: { winback_redeemed: "1" },
    });
  });

  it("pauses weekly collection and flags redemption in one update", async () => {
    await applyWeeklyPause("sub_1", 1_800_000_000);
    expect(subsUpdate).toHaveBeenCalledWith("sub_1", {
      pause_collection: { behavior: "void", resumes_at: 1_800_000_000 },
      metadata: { pause_redeemed: "1" },
    });
  });

  it("sets and unsets cancel_at_period_end", async () => {
    await setCancelAtPeriodEnd("sub_1", true);
    expect(subsUpdate).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    await setCancelAtPeriodEnd("sub_1", false);
    expect(subsUpdate).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: false });
  });
});

describe("ensurePortalConfiguration", () => {
  it("reuses a configuration matching the metadata key", async () => {
    portalConfigList.mockResolvedValue({
      data: [{ id: "bpc_1", metadata: { v2p: "manage-default" } }],
    });
    expect(await ensurePortalConfiguration(false)).toBe("bpc_1");
    expect(portalConfigCreate).not.toHaveBeenCalled();
  });

  it("creates the cancel-enabled fallback configuration when missing", async () => {
    portalConfigList.mockResolvedValue({ data: [] });
    portalConfigCreate.mockResolvedValue({ id: "bpc_2" });
    expect(await ensurePortalConfiguration(true)).toBe("bpc_2");
    const arg = portalConfigCreate.mock.calls[0][0];
    expect(arg.metadata).toEqual({ v2p: "manage-cancel-fallback" });
    expect(arg.features.subscription_cancel).toEqual({
      enabled: true,
      mode: "at_period_end",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/manage/__tests__/stripeOps.test.ts`
Expected: FAIL, cannot resolve `@/lib/manage/stripeOps`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/manage/stripeOps.ts
import { stripe } from "@/lib/stripe/client";
import { MANAGE_CONFIG } from "./config";

// All operations are idempotent from the caller's perspective: coupons and portal
// configurations are ensure-style (create only when missing), and subscription
// updates set absolute state. Metadata updates merge per key in Stripe, so the
// webhook's metadata.email is never clobbered.

export async function ensureWinbackCoupon(): Promise<string> {
  try {
    const existing = await stripe.coupons.retrieve(MANAGE_CONFIG.winbackCouponId);
    return existing.id;
  } catch (err) {
    // Stripe errors carry code "resource_missing" for unknown ids; anything else
    // (auth, network) should propagate.
    if ((err as { code?: string })?.code !== "resource_missing") throw err;
  }
  const created = await stripe.coupons.create({
    id: MANAGE_CONFIG.winbackCouponId,
    amount_off: MANAGE_CONFIG.winbackAmountOffCents,
    currency: "usd",
    duration: "once",
    name: "Winback: next year $0.99",
  });
  return created.id;
}

export async function applyAnnualWinback(subscriptionId: string): Promise<void> {
  const coupon = await ensureWinbackCoupon();
  await stripe.subscriptions.update(subscriptionId, {
    discounts: [{ coupon }],
    metadata: { winback_redeemed: "1" },
  });
}

export async function applyWeeklyPause(
  subscriptionId: string,
  resumesAtSec: number,
): Promise<void> {
  await stripe.subscriptions.update(subscriptionId, {
    pause_collection: { behavior: "void", resumes_at: resumesAtSec },
    metadata: { pause_redeemed: "1" },
  });
}

export async function setCancelAtPeriodEnd(
  subscriptionId: string,
  value: boolean,
): Promise<void> {
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: value,
  });
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.video2pdf.ai";

export async function ensurePortalConfiguration(
  allowCancel: boolean,
): Promise<string> {
  const key = allowCancel ? "manage-cancel-fallback" : "manage-default";
  const existing = await stripe.billingPortal.configurations.list({ limit: 100 });
  const match = existing.data.find((c) => c.metadata?.v2p === key);
  if (match) return match.id;

  const created = await stripe.billingPortal.configurations.create({
    metadata: { v2p: key },
    business_profile: {
      headline: "Video2PDF",
      privacy_policy_url: `${SITE}/privacy`,
      terms_of_service_url: `${SITE}/terms`,
    },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      subscription_cancel: allowCancel
        ? { enabled: true, mode: "at_period_end" }
        : { enabled: false },
    },
  });
  return created.id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/manage/__tests__/stripeOps.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/manage/stripeOps.ts lib/manage/__tests__/stripeOps.test.ts
git commit -m "Add Stripe operations for winback coupon, pause, cancel, portal configs"
```

---

### Task 6: offer, cancel, resume, and feedback endpoints

**Files:**
- Create: `app/api/manage/offer/route.ts`
- Create: `app/api/manage/cancel/route.ts`
- Create: `app/api/manage/resume/route.ts`
- Create: `app/api/manage/feedback/route.ts`
- Create: `lib/manage/auth.ts` (shared token-and-subscription loader for these routes)
- Test: `app/api/manage/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `verifyManageToken` (Task 2), overview helpers (Task 3), `stripeOps` (Task 5), `insertCancellationEvent` (Task 1), `stripe` client.
- Produces (client contract for Task 9):
  - `POST /api/manage/offer` body `{ token }` returns `{ ok: true, outcome: "saved_offer" | "paused" }`; `409 { error }` when the offer is not available; `401` on bad token.
  - `POST /api/manage/cancel` body `{ token, reason?, comment? }` returns `{ ok: true, endsAt: number | null }`.
  - `POST /api/manage/resume` body `{ token }` returns `{ ok: true }`.
  - `POST /api/manage/feedback` body `{ token, reason, comment?, stepReached, outcome? }` returns `{ ok: true }`.
  - `lib/manage/auth.ts` exports `loadManagedSubscription(token: string): Promise<{ email: string; sub: StripeSubLike; overview: ManageOverview } | null>` (null covers bad token, missing sub, unknown price).

- [ ] **Step 1: Write the shared loader**

```ts
// lib/manage/auth.ts
import { stripe, PRICE_TO_PLAN } from "@/lib/stripe/client";
import { verifyManageToken } from "./token";
import {
  mapSubscriptionToOverview,
  type ManageOverview,
  type StripeSubLike,
} from "./overview";

export interface ManagedSubscription {
  email: string;
  sub: StripeSubLike;
  overview: ManageOverview;
}

// Verifies the manage token and re-fetches the subscription so every action
// route decides on fresh Stripe state, never on client-supplied claims.
export async function loadManagedSubscription(
  token: unknown,
): Promise<ManagedSubscription | null> {
  if (typeof token !== "string") return null;
  const payload = await verifyManageToken(token);
  if (!payload) return null;
  try {
    const raw = await stripe.subscriptions.retrieve(payload.subscriptionId);
    // Narrow Stripe's wide Subscription type to the fields we read.
    const sub = raw as unknown as StripeSubLike;
    const overview = mapSubscriptionToOverview(sub, PRICE_TO_PLAN);
    if (!overview) return null;
    return { email: payload.email, sub, overview };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write the failing route tests**

```ts
// app/api/manage/__tests__/actions.test.ts
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

const subsRetrieve = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  stripe: { subscriptions: { retrieve: (...a: unknown[]) => subsRetrieve(...a) } },
  PRICE_TO_PLAN: { price_a: "annual", price_w: "weekly" },
}));

const applyAnnualWinback = vi.fn().mockResolvedValue(undefined);
const applyWeeklyPause = vi.fn().mockResolvedValue(undefined);
const setCancelAtPeriodEnd = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/manage/stripeOps", () => ({
  applyAnnualWinback: (...a: unknown[]) => applyAnnualWinback(...a),
  applyWeeklyPause: (...a: unknown[]) => applyWeeklyPause(...a),
  setCancelAtPeriodEnd: (...a: unknown[]) => setCancelAtPeriodEnd(...a),
}));

const insertEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/db/cancellationEvents", () => ({
  insertCancellationEvent: (...a: unknown[]) => insertEvent(...a),
}));

import { POST as offerPOST } from "@/app/api/manage/offer/route";
import { POST as cancelPOST } from "@/app/api/manage/cancel/route";
import { POST as resumePOST } from "@/app/api/manage/resume/route";
import { POST as feedbackPOST } from "@/app/api/manage/feedback/route";
import { signManageToken } from "@/lib/manage/token";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

function req(path: string, body: unknown): Request {
  return new Request(`http://test/api/manage/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const annualSub = {
  id: "sub_1",
  status: "active",
  cancel_at_period_end: false,
  created: 1,
  metadata: {},
  items: { data: [{ price: { id: "price_a" }, current_period_end: 1_800_000_000 }] },
};

let token = "";
beforeAll(async () => {
  token = await signManageToken({ subscriptionId: "sub_1", email: "a@b.c" });
});

beforeEach(() => {
  subsRetrieve.mockReset().mockResolvedValue(annualSub);
  applyAnnualWinback.mockClear();
  applyWeeklyPause.mockClear();
  setCancelAtPeriodEnd.mockClear();
  insertEvent.mockClear();
});

describe("POST /api/manage/offer", () => {
  it("401s on a bad token", async () => {
    expect((await offerPOST(req("offer", { token: "junk" }))).status).toBe(401);
  });

  it("applies the annual winback and records the outcome", async () => {
    const res = await offerPOST(req("offer", { token }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, outcome: "saved_offer" });
    expect(applyAnnualWinback).toHaveBeenCalledWith("sub_1");
    expect(insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.c", plan: "annual", outcome: "saved_offer" }),
    );
  });

  it("pauses a weekly subscription instead", async () => {
    subsRetrieve.mockResolvedValue({
      ...annualSub,
      items: { data: [{ price: { id: "price_w" }, current_period_end: 1_800_000_000 }] },
    });
    const res = await offerPOST(req("offer", { token }));
    expect(await res.json()).toEqual({ ok: true, outcome: "paused" });
    expect(applyWeeklyPause).toHaveBeenCalledWith("sub_1", expect.any(Number));
    const resumesAt = applyWeeklyPause.mock.calls[0][1] as number;
    const expected = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    expect(Math.abs(resumesAt - expected)).toBeLessThan(60);
  });

  it("409s when already redeemed (server-side re-check)", async () => {
    subsRetrieve.mockResolvedValue({
      ...annualSub,
      metadata: { winback_redeemed: "1" },
    });
    expect((await offerPOST(req("offer", { token }))).status).toBe(409);
    expect(applyAnnualWinback).not.toHaveBeenCalled();
  });
});

describe("POST /api/manage/cancel", () => {
  it("sets cancel_at_period_end and records reason and outcome", async () => {
    const res = await cancelPOST(
      req("cancel", { token, reason: "too_expensive", comment: "x" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, endsAt: 1_800_000_000_000 });
    expect(setCancelAtPeriodEnd).toHaveBeenCalledWith("sub_1", true);
    expect(insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "too_expensive", outcome: "canceled" }),
    );
  });

  it("still cancels when the event insert fails", async () => {
    insertEvent.mockRejectedValueOnce(new Error("db down"));
    const res = await cancelPOST(req("cancel", { token }));
    expect(res.status).toBe(200);
    expect(setCancelAtPeriodEnd).toHaveBeenCalledWith("sub_1", true);
  });
});

describe("POST /api/manage/resume", () => {
  it("unsets cancel_at_period_end and records the outcome", async () => {
    const res = await resumePOST(req("resume", { token }));
    expect(res.status).toBe(200);
    expect(setCancelAtPeriodEnd).toHaveBeenCalledWith("sub_1", false);
    expect(insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "resumed" }),
    );
  });
});

describe("POST /api/manage/feedback", () => {
  it("records the survey answer", async () => {
    const res = await feedbackPOST(
      req("feedback", { token, reason: "not_using", stepReached: "survey" }),
    );
    expect(res.status).toBe(200);
    expect(insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "not_using", stepReached: "survey" }),
    );
  });

  it("rejects an unknown stepReached", async () => {
    const res = await feedbackPOST(
      req("feedback", { token, reason: "not_using", stepReached: "nope" }),
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run app/api/manage/__tests__/actions.test.ts`
Expected: FAIL, cannot resolve the route modules.

- [ ] **Step 4: Write the four routes**

```ts
// app/api/manage/offer/route.ts
import { NextResponse } from "next/server";
import { loadManagedSubscription } from "@/lib/manage/auth";
import { applyAnnualWinback, applyWeeklyPause } from "@/lib/manage/stripeOps";
import { insertCancellationEvent } from "@/lib/db/cancellationEvents";
import { MANAGE_CONFIG } from "@/lib/manage/config";

export async function POST(request: Request): Promise<NextResponse> {
  const { token } = await request.json().catch(() => ({}));
  const managed = await loadManagedSubscription(token);
  if (!managed) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
  const { email, sub, overview } = managed;
  if (!overview.offerAvailable) {
    return NextResponse.json({ error: "Offer not available" }, { status: 409 });
  }

  try {
    let outcome: "saved_offer" | "paused";
    if (overview.plan === "annual") {
      await applyAnnualWinback(sub.id);
      outcome = "saved_offer";
    } else {
      const resumesAt =
        Math.floor(Date.now() / 1000) + MANAGE_CONFIG.pauseDays * 24 * 60 * 60;
      await applyWeeklyPause(sub.id, resumesAt);
      outcome = "paused";
    }
    // Feedback write must never block the save.
    await insertCancellationEvent({
      email,
      plan: overview.plan,
      stepReached: "offer",
      outcome,
    }).catch(() => {});
    return NextResponse.json({ ok: true, outcome });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
```

```ts
// app/api/manage/cancel/route.ts
import { NextResponse } from "next/server";
import { loadManagedSubscription } from "@/lib/manage/auth";
import { setCancelAtPeriodEnd } from "@/lib/manage/stripeOps";
import { insertCancellationEvent } from "@/lib/db/cancellationEvents";

export async function POST(request: Request): Promise<NextResponse> {
  const { token, reason, comment } = await request.json().catch(() => ({}));
  const managed = await loadManagedSubscription(token);
  if (!managed) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
  const { email, sub, overview } = managed;

  try {
    await setCancelAtPeriodEnd(sub.id, true);
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
  await insertCancellationEvent({
    email,
    plan: overview.plan,
    reason: typeof reason === "string" ? reason : null,
    comment: typeof comment === "string" ? comment : null,
    stepReached: "confirm",
    outcome: "canceled",
  }).catch(() => {});
  return NextResponse.json({ ok: true, endsAt: overview.currentPeriodEnd });
}
```

```ts
// app/api/manage/resume/route.ts
import { NextResponse } from "next/server";
import { loadManagedSubscription } from "@/lib/manage/auth";
import { setCancelAtPeriodEnd } from "@/lib/manage/stripeOps";
import { insertCancellationEvent } from "@/lib/db/cancellationEvents";

export async function POST(request: Request): Promise<NextResponse> {
  const { token } = await request.json().catch(() => ({}));
  const managed = await loadManagedSubscription(token);
  if (!managed) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
  try {
    await setCancelAtPeriodEnd(managed.sub.id, false);
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
  await insertCancellationEvent({
    email: managed.email,
    plan: managed.overview.plan,
    stepReached: "confirm",
    outcome: "resumed",
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
```

```ts
// app/api/manage/feedback/route.ts
import { NextResponse } from "next/server";
import { loadManagedSubscription } from "@/lib/manage/auth";
import {
  insertCancellationEvent,
  type CancelOutcome,
  type CancelStep,
} from "@/lib/db/cancellationEvents";

const STEPS: ReadonlySet<string> = new Set(["survey", "loss", "offer", "confirm"]);
const OUTCOMES: ReadonlySet<string> = new Set([
  "saved_offer",
  "paused",
  "canceled",
  "resumed",
  "abandoned_kept",
]);

export async function POST(request: Request): Promise<NextResponse> {
  const { token, reason, comment, stepReached, outcome } = await request
    .json()
    .catch(() => ({}));
  const managed = await loadManagedSubscription(token);
  if (!managed) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
  if (typeof stepReached !== "string" || !STEPS.has(stepReached)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }
  const validOutcome =
    typeof outcome === "string" && OUTCOMES.has(outcome)
      ? (outcome as CancelOutcome)
      : null;
  await insertCancellationEvent({
    email: managed.email,
    plan: managed.overview.plan,
    reason: typeof reason === "string" ? reason : null,
    comment: typeof comment === "string" ? comment : null,
    stepReached: stepReached as CancelStep,
    outcome: validOutcome,
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run app/api/manage/__tests__/actions.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/manage/auth.ts app/api/manage/offer app/api/manage/cancel app/api/manage/resume app/api/manage/feedback app/api/manage/__tests__/actions.test.ts
git commit -m "Add offer, cancel, resume and feedback endpoints for cancel flow"
```

---

### Task 7: portal endpoint (payment methods only) and old route removal

**Files:**
- Create: `app/api/manage/portal/route.ts`
- Delete: `app/api/portal/route.ts`
- Modify: none (verify no other references first)
- Test: `app/api/manage/__tests__/portal.test.ts`

**Interfaces:**
- Consumes: `loadManagedSubscription` (Task 6), `ensurePortalConfiguration` (Task 5), `stripe` client.
- Produces: `POST /api/manage/portal` body `{ token, fallbackCancel?: boolean }` returning `{ url }`. Default sessions use the cancel-disabled configuration; `fallbackCancel: true` uses the cancel-enabled configuration (only invoked by the wizard after a failed cancel call, and it is Stripe's own online cancel, so the always-cancelable guarantee holds).

- [ ] **Step 1: Verify nothing else calls the old route**

Run: `grep -rn "api/portal" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".next"`
Expected: only `app/api/portal/route.ts` itself and `app/manage/components/ManageForm.tsx` (rewritten in Task 8). If anything else appears, stop and report before deleting.

- [ ] **Step 2: Write the failing test**

```ts
// app/api/manage/__tests__/portal.test.ts
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

const subsRetrieve = vi.fn();
const sessionsCreate = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    subscriptions: { retrieve: (...a: unknown[]) => subsRetrieve(...a) },
    billingPortal: {
      sessions: { create: (...a: unknown[]) => sessionsCreate(...a) },
    },
  },
  PRICE_TO_PLAN: { price_a: "annual" },
}));

const ensurePortalConfiguration = vi.fn();
vi.mock("@/lib/manage/stripeOps", () => ({
  ensurePortalConfiguration: (...a: unknown[]) => ensurePortalConfiguration(...a),
}));

import { POST } from "@/app/api/manage/portal/route";
import { signManageToken } from "@/lib/manage/token";

let token = "";
beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  token = await signManageToken({ subscriptionId: "sub_1", email: "a@b.c" });
});

beforeEach(() => {
  subsRetrieve.mockReset().mockResolvedValue({
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    created: 1,
    metadata: {},
    items: { data: [{ price: { id: "price_a" }, current_period_end: 1 }] },
  });
  sessionsCreate.mockReset().mockResolvedValue({ url: "https://portal" });
  ensurePortalConfiguration.mockReset().mockResolvedValue("bpc_default");
});

function req(body: unknown): Request {
  return new Request("http://test/api/manage/portal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/manage/portal", () => {
  it("401s on a bad token", async () => {
    expect((await POST(req({ token: "junk" }))).status).toBe(401);
  });

  it("creates a session with the cancel-disabled configuration by default", async () => {
    const res = await POST(req({ token }));
    expect(await res.json()).toEqual({ url: "https://portal" });
    expect(ensurePortalConfiguration).toHaveBeenCalledWith(false);
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1", configuration: "bpc_default" }),
    );
  });

  it("uses the cancel-enabled configuration for the fallback", async () => {
    await POST(req({ token, fallbackCancel: true }));
    expect(ensurePortalConfiguration).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run app/api/manage/__tests__/portal.test.ts`
Expected: FAIL, cannot resolve the route module.

- [ ] **Step 4: Write the route and delete the old one**

```ts
// app/api/manage/portal/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { loadManagedSubscription } from "@/lib/manage/auth";
import { ensurePortalConfiguration } from "@/lib/manage/stripeOps";

export async function POST(request: Request): Promise<NextResponse> {
  const { token, fallbackCancel } = await request.json().catch(() => ({}));
  const managed = await loadManagedSubscription(token);
  if (!managed) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.video2pdf.ai";
  try {
    const configuration = await ensurePortalConfiguration(fallbackCancel === true);
    const customer = (managed.sub as unknown as { customer: string }).customer;
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      configuration,
      return_url: `${site}/manage`,
    });
    return NextResponse.json({ url: portal.url });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
```

Note: `StripeSubLike` (Task 3) does not include `customer`; add it there instead of casting if you prefer, but keep the shape minimal. Either way the test above must pass unchanged.

```bash
rm -r app/api/portal
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run app/api/manage/__tests__/portal.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A app/api/portal app/api/manage/portal app/api/manage/__tests__/portal.test.ts
git commit -m "Move portal sessions behind manage token with cancel disabled"
```

---

### Task 8: /manage overview page rework

**Files:**
- Modify: `app/manage/components/ManageForm.tsx` (full rewrite)
- Test: `app/manage/__tests__/manageForm.test.tsx`

**Interfaces:**
- Consumes: `POST /api/manage/lookup` and `/api/manage/portal`, `/api/manage/resume` response shapes (Tasks 4, 6, 7), `ManageOverview` type (Task 3).
- Produces: on "Cancel subscription" click, stores `JSON.stringify({ token, overview })` in `sessionStorage` under key `"v2p_manage"` and navigates to `/manage/cancel` via `window.location.assign`. Task 9 reads exactly that key and shape.

Layout follows the existing brand classes already used in ManageForm and Funnel (`bg-brand-bg`, `bg-brand-bg-card`, `border-brand-border`, `text-brand-text-secondary`, `bg-brand-primary`).

- [ ] **Step 1: Write the failing component test**

```tsx
// app/manage/__tests__/manageForm.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManageForm } from "@/app/manage/components/ManageForm";

const overview = {
  plan: "annual",
  priceLabel: "$29.99",
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: 1_800_000_000_000,
  trialing: false,
  pastDue: false,
  winbackRedeemed: false,
  pauseRedeemed: false,
  offerAvailable: true,
};

function mockLookup(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      json: async () => body,
    }),
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

async function lookupWith(body: unknown, status = 200) {
  mockLookup(body, status);
  render(<ManageForm />);
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value: "a@b.c" },
  });
  fireEvent.click(screen.getByRole("button", { name: /find my subscription/i }));
}

describe("ManageForm", () => {
  it("shows the overview after a successful lookup", async () => {
    await lookupWith({ token: "tok", overview });
    await waitFor(() => {
      expect(screen.getByText(/annual/i)).toBeTruthy();
      expect(screen.getByText(/\$29\.99/)).toBeTruthy();
      expect(screen.getByRole("button", { name: /update payment method/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /cancel subscription/i })).toBeTruthy();
    });
  });

  it("stores the flow state and navigates on cancel click", async () => {
    const assign = vi.fn();
    // jsdom's window.location is not configurable via defineProperty in all
    // versions; stubGlobal replaces the whole object for this test.
    vi.stubGlobal("location", { ...window.location, assign });
    await lookupWith({ token: "tok", overview });
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /cancel subscription/i })),
    );
    expect(JSON.parse(sessionStorage.getItem("v2p_manage") ?? "{}")).toMatchObject({
      token: "tok",
    });
    expect(assign).toHaveBeenCalledWith("/manage/cancel");
  });

  it("shows a resume button when already set to cancel", async () => {
    await lookupWith({
      token: "tok",
      overview: { ...overview, cancelAtPeriodEnd: true },
    });
    await waitFor(() => {
      expect(screen.getByText(/your plan ends on/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /resume subscription/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^cancel subscription$/i })).toBeNull();
    });
  });

  it("shows the not-found error", async () => {
    await lookupWith({ error: "No subscription found for that email" }, 404);
    await waitFor(() =>
      expect(screen.getByText(/could not find a subscription/i)).toBeTruthy(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/manage/__tests__/manageForm.test.tsx`
Expected: FAIL (current ManageForm has no "Find my subscription" button or overview view).

- [ ] **Step 3: Rewrite ManageForm.tsx**

```tsx
// app/manage/components/ManageForm.tsx
"use client";

import { useState } from "react";
import type { ManageOverview } from "@/lib/manage/overview";

const PLAN_NAMES = { weekly: "Weekly", annual: "Annual" } as const;

export function fmtDate(ms: number | null): string {
  if (ms == null) return "your renewal date";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ManageForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<ManageOverview | null>(null);
  const [resumed, setResumed] = useState(false);

  async function post(path: string, body: unknown): Promise<Response> {
    return fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function lookup() {
    setError(null);
    setBusy(true);
    try {
      const res = await post("/api/manage/lookup", { email });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        setError(
          data?.error === "No subscription found for that email"
            ? "We could not find a subscription for that email."
            : "Something went wrong. Please try again.",
        );
        return;
      }
      setToken(data.token);
      setOverview(data.overview);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await post("/api/manage/portal", { token });
      const data = await res.json().catch(() => ({}));
      if (data?.url) window.location.assign(data.url);
      else setError("Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await post("/api/manage/resume", { token });
      if (res.ok) setResumed(true);
      else setError("Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function startCancelFlow() {
    if (!token || !overview) return;
    sessionStorage.setItem("v2p_manage", JSON.stringify({ token, overview }));
    window.location.assign("/manage/cancel");
  }

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-brand-bg text-brand-text flex flex-col items-center px-6 pt-10 pb-10">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        {children}
        {error && (
          <p role="alert" className="mt-4 w-full text-center text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    </main>
  );

  if (overview && token) {
    if (resumed) {
      return shell(
        <>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-brand-text-secondary">
            Your plan is active again and renews on {fmtDate(overview.currentPeriodEnd)}.
          </p>
        </>,
      );
    }
    return shell(
      <>
        <h1 className="text-2xl font-bold">Your subscription</h1>
        <div className="mt-6 w-full rounded-lg border border-brand-border bg-brand-bg-card p-5 text-left">
          <p className="font-semibold">
            {PLAN_NAMES[overview.plan]} plan, {overview.priceLabel}
          </p>
          <p className="mt-1 text-sm text-brand-text-secondary">
            {overview.cancelAtPeriodEnd
              ? `Your plan ends on ${fmtDate(overview.currentPeriodEnd)}.`
              : overview.pastDue
                ? "Your last payment failed. Update your payment method to keep access."
                : `Renews on ${fmtDate(overview.currentPeriodEnd)}.`}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={openPortal}
          className="mt-6 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          Update payment method
        </button>
        {overview.cancelAtPeriodEnd ? (
          <button
            type="button"
            disabled={busy}
            onClick={resume}
            className="mt-3 w-full rounded-lg border border-brand-border px-8 py-4 text-base font-semibold disabled:opacity-40"
          >
            Resume subscription
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={startCancelFlow}
            className="mt-4 text-sm text-brand-text-secondary underline"
          >
            Cancel subscription
          </button>
        )}
      </>,
    );
  }

  return shell(
    <>
      <h1 className="text-2xl font-bold">Manage your subscription</h1>
      <p className="mt-2 text-sm text-brand-text-secondary">
        Enter the email you subscribed with to manage or cancel your plan.
      </p>
      <label htmlFor="manage-email" className="sr-only">
        Your email
      </label>
      <input
        id="manage-email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-6 w-full rounded-lg border border-brand-border bg-brand-bg-card px-4 py-4 text-brand-text"
      />
      <button
        type="button"
        disabled={busy || !email}
        onClick={lookup}
        className="mt-6 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
      >
        Find my subscription
      </button>
    </>,
  );
}
```

Note the past-due branch renders the cancel link too (`startCancelFlow`), and Task 9's wizard skips the offer step because `offerAvailable` is false; no extra handling needed here.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/manage/__tests__/manageForm.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/manage/components/ManageForm.tsx app/manage/__tests__/manageForm.test.tsx
git commit -m "Rework manage page into lookup plus subscription overview"
```

---

### Task 9: cancel wizard UI

**Files:**
- Create: `app/manage/cancel/page.tsx`
- Create: `app/manage/cancel/components/CancelWizard.tsx`
- Test: `app/manage/cancel/__tests__/cancelWizard.test.tsx`

**Interfaces:**
- Consumes: sessionStorage key `"v2p_manage"` with `{ token: string, overview: ManageOverview }` (Task 8), API contracts from Tasks 6 and 7, `MANAGE_CONFIG.cancelReasons` (Task 3), `fmtDate` from `@/app/manage/components/ManageForm` (Task 8).
- Produces: the complete 4-step flow. No later task consumes this; it is the user-facing deliverable.

Wizard behavior (spec sections 2 and 7):

- Steps: `survey -> loss -> offer -> confirm`, plus terminal views `done` (canceled), `saved` (offer accepted), `kept` (chose to keep benefits). `offer` is skipped when `overview.offerAvailable` is false.
- Every non-terminal step renders a link or button matching `/continue to cancel|no thanks, cancel my plan/i`.
- Step 1 survey: reason buttons from `MANAGE_CONFIG.cancelReasons`, optional comment textarea, fire-and-forget POST to `/api/manage/feedback` with `{ token, reason, comment, stepReached: "survey" }` on advance; "Continue to cancel" advances with reason `"skipped"`.
- Step 2 loss screen: headline `Here's what you'll lose on {fmtDate(currentPeriodEnd)}`; a hero card with a badge `Only on Video2PDF`, title `Crisp, clean PDFs generated from your videos`, and support copy `Video2PDF is the only app that turns your videos into crisp, print-ready PDFs.`; then the list: Full-resolution scans, Searchable, copyable PDFs, Unlimited documents; framing line `You keep all of this until {date}. After that it's gone.`; primary button `Keep my benefits` (POSTs feedback with `stepReached: "loss"`, `outcome: "abandoned_kept"`, then shows the `kept` view with a link back to /manage); quiet link `Continue to cancel`.
- Step 3 offer: annual copy: headline `Stay for $0.99`, sub `Your entire next year, 97% off.`, fine print `Your next annual renewal on {date} will be $0.99. After that, $29.99/yr unless canceled.`; weekly copy: headline `Take 30 days on us`, sub `No charges for 30 days. Pick up right where you left off.`, fine print `No charges until {date 30 days out}. Your plan resumes automatically at $4.99/wk.`; accept button POSTs `/api/manage/offer`; on `{ ok: true }` show `saved` view (`You're all set: your next year is $0.99` or `Paused. Enjoy your 30 days on us.`); on failure show inline retry text `Something went wrong. Please try again.`; quiet link `No thanks, cancel my plan`.
- Step 4 confirm: `Your plan will end on {date}. You'll keep full access until then.`; button `Cancel my subscription` POSTs `/api/manage/cancel` with `{ token, reason, comment }` collected at step 1; on success show `done`: `Canceled. You have access until {date}. Changed your mind? Resume anytime at video2pdf.ai/manage.`; after 2 failed attempts, show a fallback button `Cancel through our billing provider` that POSTs `/api/manage/portal` with `{ token, fallbackCancel: true }` and redirects to the returned url (legal requirement: cancellation must always complete online).
- On mount, read sessionStorage; if missing or unparseable, `window.location.replace("/manage")`.
- Reuse the funnel shell pattern (StepProgress-style bar optional, `step-enter` animation class via `import "../../go/funnel.css"` is fine to skip; plain brand classes suffice).

- [ ] **Step 1: Write the failing component tests**

```tsx
// app/manage/cancel/__tests__/cancelWizard.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CancelWizard } from "@/app/manage/cancel/components/CancelWizard";

const annual = {
  plan: "annual",
  priceLabel: "$29.99",
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: 1_800_000_000_000,
  trialing: false,
  pastDue: false,
  winbackRedeemed: false,
  pauseRedeemed: false,
  offerAvailable: true,
};

function seed(overview: object) {
  sessionStorage.setItem("v2p_manage", JSON.stringify({ token: "tok", overview }));
}

function mockFetch(responses: Record<string, unknown> = {}) {
  const calls: Array<{ url: string; body: unknown }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      const body = responses[url] ?? { ok: true };
      return { ok: true, status: 200, json: async () => body };
    }),
  );
  return calls;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function advancePastSurvey() {
  fireEvent.click(screen.getByRole("button", { name: /too expensive/i }));
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
}

describe("CancelWizard", () => {
  it("walks survey, loss, offer, confirm to done, with continue-to-cancel on every step", async () => {
    seed(annual);
    const calls = mockFetch({
      "/api/manage/cancel": { ok: true, endsAt: annual.currentPeriodEnd },
    });
    render(<CancelWizard />);

    // survey
    expect(screen.getByText(/what's not working/i)).toBeTruthy();
    expect(screen.getByText(/continue to cancel/i)).toBeTruthy();
    advancePastSurvey();

    // loss
    expect(await screen.findByText(/here's what you'll lose/i)).toBeTruthy();
    expect(screen.getByText(/crisp, clean pdfs generated from your videos/i)).toBeTruthy();
    expect(screen.getByText(/only on video2pdf/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/continue to cancel/i));

    // offer
    expect(await screen.findByText(/stay for \$0\.99/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/no thanks, cancel my plan/i));

    // confirm
    expect(await screen.findByText(/your plan will end on/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /cancel my subscription/i }));

    await waitFor(() => expect(screen.getByText(/canceled\./i)).toBeTruthy());
    const cancelCall = calls.find((c) => c.url === "/api/manage/cancel");
    expect(cancelCall?.body).toMatchObject({ token: "tok", reason: "too_expensive" });
  });

  it("accepting the annual offer short-circuits to the saved view", async () => {
    seed(annual);
    mockFetch({ "/api/manage/offer": { ok: true, outcome: "saved_offer" } });
    render(<CancelWizard />);
    advancePastSurvey();
    fireEvent.click(await screen.findByText(/continue to cancel/i));
    fireEvent.click(await screen.findByRole("button", { name: /stay for \$0\.99/i }));
    await waitFor(() =>
      expect(screen.getByText(/your next year is \$0\.99/i)).toBeTruthy(),
    );
  });

  it("shows the pause offer for weekly", async () => {
    seed({ ...annual, plan: "weekly", priceLabel: "$4.99" });
    mockFetch();
    render(<CancelWizard />);
    advancePastSurvey();
    fireEvent.click(await screen.findByText(/continue to cancel/i));
    expect(await screen.findByText(/take 30 days on us/i)).toBeTruthy();
  });

  it("skips the offer step when offerAvailable is false", async () => {
    seed({ ...annual, winbackRedeemed: true, offerAvailable: false });
    mockFetch();
    render(<CancelWizard />);
    advancePastSurvey();
    fireEvent.click(await screen.findByText(/continue to cancel/i));
    expect(await screen.findByText(/your plan will end on/i)).toBeTruthy();
    expect(screen.queryByText(/stay for \$0\.99/i)).toBeNull();
  });

  it("keep-my-benefits exits with the kept view", async () => {
    seed(annual);
    const calls = mockFetch();
    render(<CancelWizard />);
    advancePastSurvey();
    fireEvent.click(await screen.findByRole("button", { name: /keep my benefits/i }));
    await waitFor(() => expect(screen.getByText(/great choice/i)).toBeTruthy());
    const fb = calls.filter((c) => c.url === "/api/manage/feedback");
    expect(fb.some((c) => (c.body as { outcome?: string }).outcome === "abandoned_kept")).toBe(true);
  });

  it("redirects to /manage when sessionStorage is empty", () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    render(<CancelWizard />);
    expect(replace).toHaveBeenCalledWith("/manage");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/manage/cancel/__tests__/cancelWizard.test.tsx`
Expected: FAIL, cannot resolve the component.

- [ ] **Step 3: Write the page and wizard**

```tsx
// app/manage/cancel/page.tsx
import { CancelWizard } from "./components/CancelWizard";

export default function CancelPage() {
  return <CancelWizard />;
}
```

```tsx
// app/manage/cancel/components/CancelWizard.tsx
"use client";

import { useEffect, useState } from "react";
import type { ManageOverview } from "@/lib/manage/overview";
import { MANAGE_CONFIG, type CancelReasonId } from "@/lib/manage/config";
import { fmtDate } from "@/app/manage/components/ManageForm";

type View = "survey" | "loss" | "offer" | "confirm" | "done" | "saved" | "kept";

interface FlowState {
  token: string;
  overview: ManageOverview;
}

const PRO_BENEFITS = [
  "Full-resolution scans",
  "Searchable, copyable PDFs",
  "Unlimited documents",
];

export function CancelWizard() {
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [view, setView] = useState<View>("survey");
  const [reason, setReason] = useState<CancelReasonId | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelFails, setCancelFails] = useState(0);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("v2p_manage");
      const parsed = raw ? (JSON.parse(raw) as FlowState) : null;
      if (parsed?.token && parsed?.overview) setFlow(parsed);
      else window.location.replace("/manage");
    } catch {
      window.location.replace("/manage");
    }
  }, []);

  if (!flow) return null;
  const { token, overview } = flow;
  const endDate = fmtDate(overview.currentPeriodEnd);

  async function post(path: string, body: unknown): Promise<Response> {
    return fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function sendFeedback(extra: Record<string, unknown>) {
    // Fire and forget: survey data must never block navigation.
    post("/api/manage/feedback", { token, reason, comment, ...extra }).catch(() => {});
  }

  function advanceFromSurvey(chosen: CancelReasonId) {
    setReason(chosen);
    post("/api/manage/feedback", {
      token,
      reason: chosen,
      comment,
      stepReached: "survey",
    }).catch(() => {});
    setView("loss");
  }

  function pastLoss() {
    setView(overview.offerAvailable ? "offer" : "confirm");
  }

  async function acceptOffer() {
    setError(null);
    setBusy(true);
    try {
      const res = await post("/api/manage/offer", { token });
      if (res.ok) setView("saved");
      else setError("Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    setError(null);
    setBusy(true);
    try {
      const res = await post("/api/manage/cancel", { token, reason, comment });
      if (res.ok) {
        setView("done");
      } else {
        setCancelFails((n) => n + 1);
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setCancelFails((n) => n + 1);
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function fallbackPortalCancel() {
    setBusy(true);
    try {
      const res = await post("/api/manage/portal", { token, fallbackCancel: true });
      const data = await res.json().catch(() => ({}));
      if (data?.url) window.location.assign(data.url);
      else setError("Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const quietLink = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 text-sm text-brand-text-secondary underline"
    >
      {label}
    </button>
  );

  const shell = (children: React.ReactNode) => (
    <main className="min-h-[100dvh] overflow-y-auto bg-brand-bg text-brand-text flex flex-col items-center px-6 pt-10 pb-16">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        {children}
        {error && (
          <p role="alert" className="mt-4 w-full text-center text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    </main>
  );

  if (view === "survey") {
    return shell(
      <>
        <h1 className="text-2xl font-bold">Before you go, what's not working?</h1>
        <div className="mt-6 w-full flex flex-col gap-3">
          {MANAGE_CONFIG.cancelReasons.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              className={`w-full rounded-lg border px-4 py-4 text-left ${
                reason === r.id
                  ? "border-brand-primary bg-brand-bg-card"
                  : "border-brand-border bg-brand-bg-card"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <textarea
          placeholder="Anything else you want us to know? (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-4 w-full rounded-lg border border-brand-border bg-brand-bg-card px-4 py-3 text-sm"
          rows={2}
        />
        <button
          type="button"
          disabled={!reason}
          onClick={() => reason && advanceFromSurvey(reason)}
          className="mt-6 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          Next
        </button>
        {quietLink("Continue to cancel", () => advanceFromSurvey("skipped"))}
      </>,
    );
  }

  if (view === "loss") {
    return shell(
      <>
        <h1 className="text-2xl font-bold">Here's what you'll lose on {endDate}</h1>
        <div className="mt-6 w-full rounded-xl border-2 border-brand-primary bg-brand-bg-card p-5 text-left">
          <span className="inline-block rounded-full bg-brand-primary px-3 py-1 text-xs font-semibold text-white">
            Only on Video2PDF
          </span>
          <p className="mt-3 text-lg font-bold">
            Crisp, clean PDFs generated from your videos
          </p>
          <p className="mt-1 text-sm text-brand-text-secondary">
            Video2PDF is the only app that turns your videos into crisp, print-ready
            PDFs.
          </p>
        </div>
        <ul className="mt-4 w-full flex flex-col gap-2 text-left">
          {PRO_BENEFITS.map((b) => (
            <li
              key={b}
              className="rounded-lg border border-brand-border bg-brand-bg-card px-4 py-3 text-sm"
            >
              {b}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-brand-text-secondary">
          You keep all of this until {endDate}. After that it's gone.
        </p>
        <button
          type="button"
          onClick={() => {
            sendFeedback({ stepReached: "loss", outcome: "abandoned_kept" });
            setView("kept");
          }}
          className="mt-6 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white"
        >
          Keep my benefits
        </button>
        {quietLink("Continue to cancel", pastLoss)}
      </>,
    );
  }

  if (view === "offer") {
    const annual = overview.plan === "annual";
    const pauseEnd = fmtDate(Date.now() + MANAGE_CONFIG.pauseDays * 24 * 60 * 60 * 1000);
    return shell(
      <>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-primary">
          Wait, one last thing
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {annual ? "Stay for $0.99" : "Take 30 days on us"}
        </h1>
        <p className="mt-2 text-brand-text-secondary">
          {annual
            ? "Your entire next year, 97% off."
            : "No charges for 30 days. Pick up right where you left off."}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={acceptOffer}
          className="mt-8 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          {annual ? "Stay for $0.99" : "Pause my plan for 30 days"}
        </button>
        <p className="mt-3 text-xs text-brand-text-secondary">
          {annual
            ? `Your next annual renewal on ${endDate} will be $0.99. After that, $29.99/yr unless canceled.`
            : `No charges until ${pauseEnd}. Your plan resumes automatically at $4.99/wk.`}
        </p>
        {quietLink("No thanks, cancel my plan", () => setView("confirm"))}
      </>,
    );
  }

  if (view === "confirm") {
    return shell(
      <>
        <h1 className="text-2xl font-bold">Your plan will end on {endDate}</h1>
        <p className="mt-2 text-sm text-brand-text-secondary">
          You'll keep full access until then.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={confirmCancel}
          className="mt-8 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          Cancel my subscription
        </button>
        {cancelFails >= 2 && (
          <button
            type="button"
            disabled={busy}
            onClick={fallbackPortalCancel}
            className="mt-4 w-full rounded-lg border border-brand-border px-8 py-4 text-sm font-semibold"
          >
            Cancel through our billing provider
          </button>
        )}
      </>,
    );
  }

  if (view === "saved") {
    return shell(
      <>
        <h1 className="text-2xl font-bold">
          {overview.plan === "annual"
            ? "You're all set: your next year is $0.99"
            : "Paused. Enjoy your 30 days on us."}
        </h1>
        <a href="/manage" className="mt-6 text-sm text-brand-text-secondary underline">
          Back to my subscription
        </a>
      </>,
    );
  }

  if (view === "kept") {
    return shell(
      <>
        <h1 className="text-2xl font-bold">Great choice</h1>
        <p className="mt-2 text-sm text-brand-text-secondary">
          Your plan continues unchanged.
        </p>
        <a href="/manage" className="mt-6 text-sm text-brand-text-secondary underline">
          Back to my subscription
        </a>
      </>,
    );
  }

  return shell(
    <>
      <h1 className="text-2xl font-bold">Canceled.</h1>
      <p className="mt-2 text-sm text-brand-text-secondary">
        You have access until {endDate}. Changed your mind? Resume anytime at
        video2pdf.ai/manage.
      </p>
    </>,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/manage/cancel/__tests__/cancelWizard.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/manage/cancel app/manage/cancel/__tests__
git commit -m "Add four-step cancel wizard with loss screen and save offers"
```

---

### Task 10: full verification and deploy notes

**Files:**
- Modify: `todo-pre-tracking.txt` is NOT in this repo; instead append a deploy note to `docs/superpowers/plans/2026-07-29-cancel-retention-flow.md` completion or report it in the final summary.

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: all suites PASS, including the untouched `lib/stripe/__tests__/webhook.test.ts` and `app/__tests__/pages.test.tsx` (if pages.test.tsx snapshots the manage page, update its expectations to the new "Find my subscription" copy in the same commit).

- [ ] **Step 2: Lint and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean. Fix anything introduced by this work only.

- [ ] **Step 3: Grep for em dashes in everything added**

Run: `grep -rn $'—' lib/manage app/manage app/api/manage lib/db/cancellationEvents.ts docs/superpowers`
Expected: no matches in the new files (the repo copy rule bans em dashes).

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "Fix lint and test fallout from cancel retention flow"
```

Only commit if steps 1 and 2 required changes.

- [ ] **Step 5: Report deploy steps (do not run them)**

Report to the user in the final summary:
1. `npm run db:setup` once against production (idempotent, adds `cancellation_events`).
2. First production use of the flow auto-creates the `winback-annual-29` coupon and the two portal configurations; optionally hit the flow once with a test subscription to pre-create them and eyeball the portal config in the Stripe dashboard.
3. The Stripe dashboard's default portal configuration still allows cancellation; our sessions always pass an explicit configuration, but any portal links created elsewhere (none known) would use the default. Optionally disable cancel on the default configuration in the dashboard too.
4. Watch `cancellation_events` for the save rate and for trial-gaming of the $0.99 offer (`MANAGE_CONFIG.offerToTrialing` is the kill switch).

---

## Self-review notes

- Spec coverage: entry/overview (Tasks 4, 8), resume (Tasks 6, 8), past-due branch (Tasks 3, 8, 9), four steps with hero loss card (Task 9), annual coupon and weekly pause with metadata flags in one atomic update (Task 5), server-side re-check via fresh retrieve (Task 6), portal cancel disabled plus fallback-enabled config (Tasks 5, 7, 9), cancellation_events (Tasks 1, 6), compliance links tested (Task 9 test asserts continue-to-cancel on every step), no webhook changes (guarded by Task 10 full run).
- The old `/api/portal` route is deleted in Task 7 with a pre-delete grep gate.
- Type names are consistent across tasks: `ManageOverview`, `StripeSubLike`, `ManageTokenPayload`, `CancellationEventInput`, `CancelStep`, `CancelOutcome`, `CancelReasonId`, `loadManagedSubscription`, `fmtDate`.
