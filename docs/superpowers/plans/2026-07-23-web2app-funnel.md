# Web2App Subscription Funnel + Meta Pixel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Zellify-style web2app funnel that charges subscriptions on the web via Stripe (matching app pricing), attributes with the Meta Pixel + Conversions API, and unlocks the account-free, receipt-based app through an email-keyed redemption bridge.

**Architecture:** Three subsystems around one shared contract (a Vercel Postgres schema + two app-facing endpoint signatures). The **site** (Next.js/Vercel) hosts the funnel, Stripe Checkout, and the Stripe webhook that is the sole writer to Postgres. The **`server/`** Express API (`api.video2pdf.ai`, in the `video2pdf-app` repo) gains two read-only entitlement endpoints. The **app** (expo) gains a minimal redeem/restore path and one branch in its entitlement resolver. Store-receipt IAP is untouched; web billing is strictly additive.

**Tech Stack:** Next.js 15 App Router + React 18 + Tailwind (site), Vitest + jsdom (site tests), Stripe hosted Checkout (subscription mode), Vercel Postgres (`@vercel/postgres`), Meta Pixel `fbq` + Conversions API, Express + TypeScript + Vitest (`server/`), Expo/React Native + expo-iap (app).

## Global Constraints

- **No em dashes** in any code, copy, comments, docs, or commit messages. Use commas, colons, parentheses, or two sentences. (Workspace rule.)
- **No commit attribution** — never add `Co-Authored-By` or attribution trailers.
- **Web pricing matches store pricing exactly:** Weekly **$4.99** (no trial, charged immediately), Annual **$29.99** with **3-day free trial**. The trial is on the ANNUAL plan only (matches the app: `PaywallScreen.tsx` reads the annual product's `freeTrialDays`; weekly has no introductory offer). No web discount.
- **Pro benefit copy verbatim from the app** (`video2pdf-app/src/constants/subscriptionCatalog.ts`): "Full-resolution scans", "Searchable, copyable PDFs", "Unlimited documents".
- **Social proof anchor:** "12,000+" users, as a single configurable constant.
- **Email is the permanent restore key.** Redemption tokens are disposable, single-use, expiring.
- **App stays account-free.** No login/auth surface is added.
- **App deep link scheme:** `video2pdf://` (bundle/package `com.vid2pdf.app`). No universal links exist, so a manual code fallback is REQUIRED.
- **Entitlement truth for web subs** = the Postgres row's `status` + `current_period_end`, maintained by Stripe webhooks. The webhook is the ONLY writer; `server/` only reads.
- **Site patterns:** App Router route handlers export `GET`/`POST` returning `NextResponse`; business logic in `@/lib/...`; tests in `__tests__` dirs. **Site tests MUST explicitly `import { describe, it, expect, vi, beforeEach } from "vitest"`** (as needed) — this is the repo's real convention; `tsc` fails without it because the repo does not reference `vitest/globals` types even though `vitest.config.ts` sets `globals: true`. (Note: the `server/` repo tests already import from `"vitest"` too, so this applies there as well.)
- **TypeScript strict**, no `any` without a comment.
- **TDD:** every task writes the failing test first, watches it fail, implements minimally, watches it pass, commits.
- Site work is on branch `feat/web2app-funnel`. `server/`/app work is on a matching branch in the `video2pdf-app` repo (`feat/web2app-funnel`).

---

## File Structure

**Site (`video2pdf-site`):**
- `lib/db/schema.sql` — Postgres DDL (subscriptions, redeem_tokens).
- `lib/db/client.ts` — thin `@vercel/postgres` accessor + typed row helpers.
- `lib/db/subscriptions.ts` — upsert/read subscription rows + token minting (site's writer side).
- `lib/stripe/client.ts` — Stripe SDK singleton + price id config.
- `lib/stripe/webhook.ts` — pure event→mutation mapper (unit-testable, no HTTP).
- `lib/pixel/events.ts` — pixel event names + typed `fbq` wrappers.
- `lib/pixel/capi.ts` — Conversions API `Purchase` sender (server-side).
- `lib/funnel/config.ts` — pricing, benefits, social-proof, deep-link constants.
- `app/api/checkout/route.ts` — `POST` creates a Checkout Session.
- `app/api/stripe/webhook/route.ts` — `POST` verifies signature, applies mutations, sends CAPI Purchase.
- `app/go/page.tsx` + `app/go/components/*` — funnel UI (landing, qualify, preview, paywall).
- `app/go/success/page.tsx` — handoff (deep link + code) and browser Purchase pixel.
- `app/components/MetaPixel.tsx` — base pixel + SPA route-change PageView.

**Server (`video2pdf-app/server`):**
- `src/db/client.ts` — `pg` pool reader over `DATABASE_URL`.
- `src/services/webEntitlement.ts` — pure entitlement normalizer from a sub row.
- `src/routes/redeem.ts` — `POST /api/v1/redeem`.
- `src/routes/webEntitlement.ts` — `POST /api/v1/web-entitlement`.
- Modify `src/index.ts` — mount the two routes.

**App (`video2pdf-app`):**
- `src/services/webEntitlementClient.ts` — calls redeem/web-entitlement, stores email + marker.
- `src/screens/RedeemScreen.tsx` — enter code / deep-link landing + restore-by-email.
- Modify `src/services/subscriptionEntitlement.ts` — add the web-entitlement branch.
- Modify deep-link handling to route `video2pdf://redeem?token=…`.

---

## Task Ordering

Contract first (Task 1), then site writer path (2–6), site funnel UI + pixel (7–10), server reader endpoints (11–13), app bridge (14–16). Each subsystem is independently testable once its upstream contract exists.

---

### Task 1: Postgres schema + typed client (the shared contract)

**Files:**
- Create: `lib/db/schema.sql`
- Create: `lib/db/client.ts`
- Test: `lib/db/__tests__/client.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Types `SubscriptionRow { email: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null; plan: 'weekly' | 'annual'; status: 'trialing' | 'active' | 'past_due' | 'canceled'; currentPeriodEnd: number | null; trialEnd: number | null; createdAt: number; updatedAt: number }` and `RedeemTokenRow { token: string; email: string; createdAt: number; expiresAt: number; consumedAt: number | null }`.
  - `mapSubscriptionRow(raw: Record<string, unknown>): SubscriptionRow` and `mapRedeemTokenRow(raw): RedeemTokenRow` (snake_case DB → camelCase; epoch ms).

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/__tests__/client.test.ts
import { mapSubscriptionRow, mapRedeemTokenRow } from "@/lib/db/client";

describe("mapSubscriptionRow", () => {
  it("maps snake_case row to typed camelCase with epoch ms", () => {
    const row = mapSubscriptionRow({
      email: "a@b.com",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      plan: "weekly",
      status: "trialing",
      current_period_end: new Date("2026-08-01T00:00:00Z"),
      trial_end: new Date("2026-07-26T00:00:00Z"),
      created_at: new Date("2026-07-23T00:00:00Z"),
      updated_at: new Date("2026-07-23T00:00:00Z"),
    });
    expect(row.email).toBe("a@b.com");
    expect(row.plan).toBe("weekly");
    expect(row.status).toBe("trialing");
    expect(row.currentPeriodEnd).toBe(Date.parse("2026-08-01T00:00:00Z"));
  });
});

describe("mapRedeemTokenRow", () => {
  it("maps a token row and preserves null consumed_at", () => {
    const t = mapRedeemTokenRow({
      token: "tok_1",
      email: "a@b.com",
      created_at: new Date("2026-07-23T00:00:00Z"),
      expires_at: new Date("2026-07-30T00:00:00Z"),
      consumed_at: null,
    });
    expect(t.token).toBe("tok_1");
    expect(t.consumedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/__tests__/client.test.ts`
Expected: FAIL ("mapSubscriptionRow is not a function" / module not found).

- [ ] **Step 3: Write the schema**

```sql
-- lib/db/schema.sql
CREATE TABLE IF NOT EXISTS subscriptions (
  email TEXT PRIMARY KEY,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('weekly','annual')),
  status TEXT NOT NULL CHECK (status IN ('trialing','active','past_due','canceled')),
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS redeem_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES subscriptions(email) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_redeem_tokens_email ON redeem_tokens(email);
```

- [ ] **Step 4: Write the client + mappers**

```ts
// lib/db/client.ts
import { sql } from "@vercel/postgres";

export type Plan = "weekly" | "annual";
export type SubStatus = "trialing" | "active" | "past_due" | "canceled";

export interface SubscriptionRow {
  email: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: Plan;
  status: SubStatus;
  currentPeriodEnd: number | null;
  trialEnd: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface RedeemTokenRow {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  consumedAt: number | null;
}

const ms = (v: unknown): number | null =>
  v == null ? null : v instanceof Date ? v.getTime() : Date.parse(String(v));

export function mapSubscriptionRow(r: Record<string, unknown>): SubscriptionRow {
  return {
    email: String(r.email),
    stripeCustomerId: (r.stripe_customer_id as string) ?? null,
    stripeSubscriptionId: (r.stripe_subscription_id as string) ?? null,
    plan: r.plan as Plan,
    status: r.status as SubStatus,
    currentPeriodEnd: ms(r.current_period_end),
    trialEnd: ms(r.trial_end),
    createdAt: ms(r.created_at) ?? 0,
    updatedAt: ms(r.updated_at) ?? 0,
  };
}

export function mapRedeemTokenRow(r: Record<string, unknown>): RedeemTokenRow {
  return {
    token: String(r.token),
    email: String(r.email),
    createdAt: ms(r.created_at) ?? 0,
    expiresAt: ms(r.expires_at) ?? 0,
    consumedAt: ms(r.consumed_at),
  };
}

export { sql };
```

- [ ] **Step 5: Add dependency, run test to verify it passes**

Run: `npm install @vercel/postgres && npx vitest run lib/db/__tests__/client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.sql lib/db/client.ts lib/db/__tests__/client.test.ts package.json package-lock.json
git commit -m "Add Postgres schema and typed row mappers for web subscriptions"
```

---

### Task 2: Funnel config constants

**Files:**
- Create: `lib/funnel/config.ts`
- Test: `lib/funnel/__tests__/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FUNNEL_CONFIG` with `socialProofCount: 12000`, `plans: { weekly: { price: '$4.99', cents: 499, trialDays: 3, interval: 'week' }, annual: { price: '$29.99', cents: 2999, trialDays: 0, interval: 'year' } }`, `proBenefits: string[]` (the three verbatim), `deepLinkScheme: 'video2pdf://'`, `finePrint(price: string, trialDays: number): string`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/funnel/__tests__/config.test.ts
import { FUNNEL_CONFIG, finePrint } from "@/lib/funnel/config";

describe("FUNNEL_CONFIG", () => {
  it("mirrors app pricing exactly", () => {
    expect(FUNNEL_CONFIG.plans.weekly.price).toBe("$4.99");
    expect(FUNNEL_CONFIG.plans.weekly.trialDays).toBe(3);
    expect(FUNNEL_CONFIG.plans.annual.price).toBe("$29.99");
  });
  it("uses the verbatim pro benefits and social proof anchor", () => {
    expect(FUNNEL_CONFIG.proBenefits).toEqual([
      "Full-resolution scans",
      "Searchable, copyable PDFs",
      "Unlimited documents",
    ]);
    expect(FUNNEL_CONFIG.socialProofCount).toBe(12000);
  });
});

describe("finePrint", () => {
  it("includes trial wording when a trial exists", () => {
    expect(finePrint("$4.99", 3)).toBe(
      "3-day free trial if eligible; then $4.99, charged automatically unless canceled 24h before renewal.",
    );
  });
  it("omits trial wording when no trial", () => {
    expect(finePrint("$29.99", 0)).toBe(
      "$29.99 charged automatically unless canceled 24h before renewal.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/funnel/__tests__/config.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement config**

```ts
// lib/funnel/config.ts
export const FUNNEL_CONFIG = {
  socialProofCount: 12000,
  deepLinkScheme: "video2pdf://",
  plans: {
    weekly: { price: "$4.99", cents: 499, trialDays: 3, interval: "week" as const },
    annual: { price: "$29.99", cents: 2999, trialDays: 0, interval: "year" as const },
  },
  proBenefits: [
    "Full-resolution scans",
    "Searchable, copyable PDFs",
    "Unlimited documents",
  ],
} as const;

export function finePrint(price: string, trialDays: number): string {
  if (trialDays > 0) {
    return `${trialDays}-day free trial if eligible; then ${price}, charged automatically unless canceled 24h before renewal.`;
  }
  return `${price} charged automatically unless canceled 24h before renewal.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/funnel/__tests__/config.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/funnel/config.ts lib/funnel/__tests__/config.test.ts
git commit -m "Add funnel config mirroring app pricing, benefits, and social proof"
```

---

### Task 3: Subscription writer + token minting (site side)

**Files:**
- Create: `lib/db/subscriptions.ts`
- Test: `lib/db/__tests__/subscriptions.test.ts`

**Interfaces:**
- Consumes: `sql`, `SubscriptionRow`, `RedeemTokenRow`, mappers from Task 1.
- Produces:
  - `upsertSubscription(input: UpsertSubscriptionInput): Promise<void>` where `UpsertSubscriptionInput = { email: string; stripeCustomerId?: string | null; stripeSubscriptionId?: string | null; plan: Plan; status: SubStatus; currentPeriodEnd?: number | null; trialEnd?: number | null }`.
  - `mintRedeemToken(email: string, ttlMs: number, token: string): Promise<string>` (token supplied by caller so it is testable; returns the token).

Note: the `sql` template is mocked in tests via `vi.mock("@vercel/postgres")`. Tests assert the query text/values, not a live DB.

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/__tests__/subscriptions.test.ts
import { vi, beforeEach } from "vitest";

const sqlMock = vi.fn(async () => ({ rows: [] }));
vi.mock("@vercel/postgres", () => ({ sql: (...a: unknown[]) => sqlMock(...a) }));

import { upsertSubscription, mintRedeemToken } from "@/lib/db/subscriptions";

beforeEach(() => sqlMock.mockClear());

describe("upsertSubscription", () => {
  it("issues an INSERT ... ON CONFLICT (email) DO UPDATE", async () => {
    await upsertSubscription({
      email: "a@b.com", plan: "weekly", status: "trialing",
      stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1",
      currentPeriodEnd: 1_800_000_000_000, trialEnd: 1_790_000_000_000,
    });
    const query = sqlMock.mock.calls[0][0].join("?");
    expect(query).toMatch(/INSERT INTO subscriptions/i);
    expect(query).toMatch(/ON CONFLICT \(email\) DO UPDATE/i);
  });
});

describe("mintRedeemToken", () => {
  it("inserts the supplied token with an expiry and returns it", async () => {
    const tok = await mintRedeemToken("a@b.com", 7 * 86400_000, "tok_fixed");
    expect(tok).toBe("tok_fixed");
    const query = sqlMock.mock.calls[0][0].join("?");
    expect(query).toMatch(/INSERT INTO redeem_tokens/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/__tests__/subscriptions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement writer**

```ts
// lib/db/subscriptions.ts
import { sql, type Plan, type SubStatus } from "./client";

export interface UpsertSubscriptionInput {
  email: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  plan: Plan;
  status: SubStatus;
  currentPeriodEnd?: number | null;
  trialEnd?: number | null;
}

const iso = (ms?: number | null) => (ms == null ? null : new Date(ms).toISOString());

export async function upsertSubscription(input: UpsertSubscriptionInput): Promise<void> {
  await sql`
    INSERT INTO subscriptions
      (email, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, trial_end, updated_at)
    VALUES
      (${input.email}, ${input.stripeCustomerId ?? null}, ${input.stripeSubscriptionId ?? null},
       ${input.plan}, ${input.status}, ${iso(input.currentPeriodEnd)}, ${iso(input.trialEnd)}, now())
    ON CONFLICT (email) DO UPDATE SET
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
      stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      current_period_end = EXCLUDED.current_period_end,
      trial_end = EXCLUDED.trial_end,
      updated_at = now()
  `;
}

export async function mintRedeemToken(email: string, ttlMs: number, token: string): Promise<string> {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await sql`
    INSERT INTO redeem_tokens (token, email, expires_at)
    VALUES (${token}, ${email}, ${expiresAt})
  `;
  return token;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db/__tests__/subscriptions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/subscriptions.ts lib/db/__tests__/subscriptions.test.ts
git commit -m "Add subscription upsert and redeem-token minting"
```

---

### Task 4: Stripe client + webhook event mapper (pure)

**Files:**
- Create: `lib/stripe/client.ts`
- Create: `lib/stripe/webhook.ts`
- Test: `lib/stripe/__tests__/webhook.test.ts`

**Interfaces:**
- Consumes: `UpsertSubscriptionInput` (Task 3), `Plan`/`SubStatus` (Task 1).
- Produces:
  - In `client.ts`: `stripe` singleton, `PRICE_TO_PLAN: Record<string, Plan>` from env `STRIPE_PRICE_WEEKLY`/`STRIPE_PRICE_ANNUAL`.
  - In `webhook.ts`: `mapEventToMutation(event: StripeEventLike, priceToPlan: Record<string, Plan>): SubscriptionMutation | null` where `StripeEventLike = { type: string; data: { object: any } }` and `SubscriptionMutation = { kind: 'upsert'; input: UpsertSubscriptionInput } | { kind: 'none' }`. Pure, no I/O.
  - `stripeStatusToLocal(s: string): SubStatus`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/stripe/__tests__/webhook.test.ts
import { mapEventToMutation, stripeStatusToLocal } from "@/lib/stripe/webhook";

const priceToPlan = { price_weekly: "weekly", price_annual: "annual" } as const;

describe("stripeStatusToLocal", () => {
  it("maps stripe statuses to local ones", () => {
    expect(stripeStatusToLocal("trialing")).toBe("trialing");
    expect(stripeStatusToLocal("active")).toBe("active");
    expect(stripeStatusToLocal("past_due")).toBe("past_due");
    expect(stripeStatusToLocal("canceled")).toBe("canceled");
    expect(stripeStatusToLocal("unpaid")).toBe("past_due");
  });
});

describe("mapEventToMutation", () => {
  it("upserts from customer.subscription.created", () => {
    const m = mapEventToMutation({
      type: "customer.subscription.created",
      data: { object: {
        customer: "cus_1", id: "sub_1", status: "trialing",
        current_period_end: 1_800_000_000, trial_end: 1_790_000_000,
        items: { data: [{ price: { id: "price_weekly" } }] },
        metadata: { email: "a@b.com" },
      } },
    }, priceToPlan);
    expect(m.kind).toBe("upsert");
    if (m.kind !== "upsert") throw new Error("expected upsert");
    expect(m.input.email).toBe("a@b.com");
    expect(m.input.plan).toBe("weekly");
    expect(m.input.status).toBe("trialing");
    expect(m.input.currentPeriodEnd).toBe(1_800_000_000 * 1000);
  });

  it("marks canceled from customer.subscription.deleted", () => {
    const m = mapEventToMutation({
      type: "customer.subscription.deleted",
      data: { object: {
        customer: "cus_1", id: "sub_1", status: "canceled",
        current_period_end: 1_800_000_000, trial_end: null,
        items: { data: [{ price: { id: "price_annual" } }] },
        metadata: { email: "a@b.com" },
      } },
    }, priceToPlan);
    if (m.kind !== "upsert") throw new Error("expected upsert");
    expect(m.input.status).toBe("canceled");
    expect(m.input.plan).toBe("annual");
  });

  it("returns none for unrelated events", () => {
    expect(mapEventToMutation({ type: "invoice.created", data: { object: {} } }, priceToPlan).kind).toBe("none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/stripe/__tests__/webhook.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement client + mapper**

```ts
// lib/stripe/client.ts
import Stripe from "stripe";
import type { Plan } from "@/lib/db/client";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-03-31.basil",
});

export const PRICE_TO_PLAN: Record<string, Plan> = {
  [process.env.STRIPE_PRICE_WEEKLY ?? "price_weekly"]: "weekly",
  [process.env.STRIPE_PRICE_ANNUAL ?? "price_annual"]: "annual",
};
```

```ts
// lib/stripe/webhook.ts
import type { Plan, SubStatus } from "@/lib/db/client";
import type { UpsertSubscriptionInput } from "@/lib/db/subscriptions";

export interface StripeEventLike { type: string; data: { object: any } }
export type SubscriptionMutation =
  | { kind: "upsert"; input: UpsertSubscriptionInput }
  | { kind: "none" };

export function stripeStatusToLocal(s: string): SubStatus {
  switch (s) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "canceled": return "canceled";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    default: return "past_due";
  }
}

const secToMs = (v: unknown): number | null =>
  typeof v === "number" ? v * 1000 : null;

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export function mapEventToMutation(
  event: StripeEventLike,
  priceToPlan: Record<string, Plan>,
): SubscriptionMutation {
  if (!SUBSCRIPTION_EVENTS.has(event.type)) return { kind: "none" };
  const o = event.data.object;
  const email = o?.metadata?.email;
  const priceId = o?.items?.data?.[0]?.price?.id;
  const plan = priceId ? priceToPlan[priceId] : undefined;
  if (!email || !plan) return { kind: "none" };
  const status =
    event.type === "customer.subscription.deleted"
      ? "canceled"
      : stripeStatusToLocal(String(o.status));
  return {
    kind: "upsert",
    input: {
      email,
      stripeCustomerId: o.customer ?? null,
      stripeSubscriptionId: o.id ?? null,
      plan,
      status,
      currentPeriodEnd: secToMs(o.current_period_end),
      trialEnd: secToMs(o.trial_end),
    },
  };
}
```

- [ ] **Step 4: Add dependency, run test to verify it passes**

Run: `npm install stripe && npx vitest run lib/stripe/__tests__/webhook.test.ts`
Expected: PASS (7 assertions across 3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/stripe/client.ts lib/stripe/webhook.ts lib/stripe/__tests__/webhook.test.ts package.json package-lock.json
git commit -m "Add Stripe client and pure webhook event-to-mutation mapper"
```

---

### Task 5: Checkout route

**Files:**
- Create: `app/api/checkout/route.ts`
- Test: `app/api/checkout/__tests__/checkout.test.ts`

**Interfaces:**
- Consumes: `stripe`, `PRICE_TO_PLAN` (Task 4), `FUNNEL_CONFIG` (Task 2).
- Produces: `POST` handler. Body `{ plan: 'weekly' | 'annual'; email: string }` → `{ url }` (Checkout Session URL). Sets `subscription_data.trial_period_days = 3` only for weekly, `customer_email`, `metadata.email`, success/cancel URLs.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/checkout/__tests__/checkout.test.ts
import { vi, beforeEach } from "vitest";

const create = vi.fn(async () => ({ url: "https://checkout.stripe.test/s/1" }));
vi.mock("@/lib/stripe/client", () => ({
  stripe: { checkout: { sessions: { create } } },
  PRICE_TO_PLAN: {},
}));
vi.stubEnv("STRIPE_PRICE_WEEKLY", "price_weekly");
vi.stubEnv("STRIPE_PRICE_ANNUAL", "price_annual");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://video2pdf.ai");

import { POST } from "@/app/api/checkout/route";

beforeEach(() => create.mockClear());

function req(body: unknown) {
  return new Request("https://video2pdf.ai/api/checkout", {
    method: "POST", body: JSON.stringify(body),
  });
}

describe("POST /api/checkout", () => {
  it("creates a weekly subscription session with a 3-day trial and email metadata", async () => {
    const res = await POST(req({ plan: "weekly", email: "a@b.com" }));
    const json = await res.json();
    expect(json.url).toBe("https://checkout.stripe.test/s/1");
    const args = create.mock.calls[0][0];
    expect(args.mode).toBe("subscription");
    expect(args.customer_email).toBe("a@b.com");
    expect(args.subscription_data.trial_period_days).toBe(3);
    expect(args.subscription_data.metadata.email).toBe("a@b.com");
    expect(args.line_items[0].price).toBe("price_weekly");
  });

  it("creates an annual session with no trial", async () => {
    await POST(req({ plan: "annual", email: "a@b.com" }));
    const args = create.mock.calls[0][0];
    expect(args.line_items[0].price).toBe("price_annual");
    expect(args.subscription_data.trial_period_days).toBeUndefined();
  });

  it("400s on a bad plan", async () => {
    const res = await POST(req({ plan: "lifetime", email: "a@b.com" }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/checkout/__tests__/checkout.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the route**

```ts
// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";

const PRICE_ENV: Record<"weekly" | "annual", string | undefined> = {
  weekly: process.env.STRIPE_PRICE_WEEKLY,
  annual: process.env.STRIPE_PRICE_ANNUAL,
};

export async function POST(request: Request): Promise<NextResponse> {
  const { plan, email } = await request.json().catch(() => ({}));
  if (plan !== "weekly" && plan !== "annual") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  const price = PRICE_ENV[plan as "weekly" | "annual"];
  if (!price) return NextResponse.json({ error: "Price not configured" }, { status: 500 });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://video2pdf.ai";
  const trialDays = FUNNEL_CONFIG.plans[plan as "weekly" | "annual"].trialDays;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price, quantity: 1 }],
    subscription_data: {
      metadata: { email },
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
    },
    success_url: `${site}/go/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/go?canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/checkout/__tests__/checkout.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/checkout/route.ts app/api/checkout/__tests__/checkout.test.ts
git commit -m "Add checkout route creating Stripe subscription sessions"
```

---

### Task 6: Stripe webhook route + CAPI Purchase

**Files:**
- Create: `lib/pixel/capi.ts`
- Create: `app/api/stripe/webhook/route.ts`
- Test: `lib/pixel/__tests__/capi.test.ts`
- Test: `app/api/stripe/webhook/__tests__/webhook-route.test.ts`

**Interfaces:**
- Consumes: `stripe`, `PRICE_TO_PLAN`, `mapEventToMutation` (Task 4), `upsertSubscription`, `mintRedeemToken` (Task 3).
- Produces:
  - `sendCapiPurchase(input: { email: string; value: number; currency: string; eventId: string }): Promise<void>` (fetch to the Meta CAPI endpoint; no-op if env unset).
  - `POST` webhook handler: verifies signature via `stripe.webhooks.constructEvent`, applies the mutation, mints a token on `checkout.session.completed`, sends CAPI Purchase on `checkout.session.completed`. Returns 200 `{ received: true }` or 400 on bad signature.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/pixel/__tests__/capi.test.ts
import { vi, beforeEach } from "vitest";
const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
vi.stubGlobal("fetch", fetchMock);
vi.stubEnv("META_PIXEL_ID", "PIX1");
vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOK1");
import { sendCapiPurchase } from "@/lib/pixel/capi";
beforeEach(() => fetchMock.mockClear());

describe("sendCapiPurchase", () => {
  it("posts a Purchase event with value, currency, and event_id", async () => {
    await sendCapiPurchase({ email: "a@b.com", value: 4.99, currency: "USD", eventId: "evt_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/PIX1/events");
    const body = JSON.parse((init as any).body);
    expect(body.data[0].event_name).toBe("Purchase");
    expect(body.data[0].event_id).toBe("evt_1");
    expect(body.data[0].custom_data.value).toBe(4.99);
    expect(body.data[0].custom_data.currency).toBe("USD");
  });
  it("no-ops when env is unset", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
    await sendCapiPurchase({ email: "a@b.com", value: 1, currency: "USD", eventId: "x" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

```ts
// app/api/stripe/webhook/__tests__/webhook-route.test.ts
import { vi, beforeEach } from "vitest";

const constructEvent = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  stripe: { webhooks: { constructEvent } },
  PRICE_TO_PLAN: { price_weekly: "weekly" },
}));
const upsertSubscription = vi.fn(async () => {});
const mintRedeemToken = vi.fn(async () => "tok_1");
vi.mock("@/lib/db/subscriptions", () => ({ upsertSubscription, mintRedeemToken }));
const sendCapiPurchase = vi.fn(async () => {});
vi.mock("@/lib/pixel/capi", () => ({ sendCapiPurchase }));
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");

import { POST } from "@/app/api/stripe/webhook/route";

beforeEach(() => { constructEvent.mockReset(); upsertSubscription.mockClear(); mintRedeemToken.mockClear(); sendCapiPurchase.mockClear(); });

function req(sig = "sig") {
  return new Request("https://video2pdf.ai/api/stripe/webhook", {
    method: "POST", headers: { "stripe-signature": sig }, body: "{}",
  });
}

describe("POST /api/stripe/webhook", () => {
  it("400s on invalid signature", async () => {
    constructEvent.mockImplementation(() => { throw new Error("bad sig"); });
    const res = await POST(req());
    expect(res.status).toBe(400);
  });

  it("upserts on customer.subscription.created", async () => {
    constructEvent.mockReturnValue({
      type: "customer.subscription.created",
      data: { object: {
        customer: "cus_1", id: "sub_1", status: "trialing",
        current_period_end: 1_800_000_000, trial_end: null,
        items: { data: [{ price: { id: "price_weekly" } }] },
        metadata: { email: "a@b.com" },
      } },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(upsertSubscription).toHaveBeenCalledTimes(1);
  });

  it("mints a token and sends CAPI Purchase on checkout.session.completed", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      id: "evt_9",
      data: { object: {
        customer: "cus_1", subscription: "sub_1",
        customer_details: { email: "a@b.com" },
        amount_total: 499, currency: "usd",
        metadata: { email: "a@b.com" },
      } },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mintRedeemToken).toHaveBeenCalledTimes(1);
    expect(sendCapiPurchase).toHaveBeenCalledTimes(1);
    const arg = sendCapiPurchase.mock.calls[0][0];
    expect(arg.value).toBe(4.99);
    expect(arg.currency).toBe("USD");
    expect(arg.eventId).toBe("evt_9");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/pixel/__tests__/capi.test.ts app/api/stripe/webhook/__tests__/webhook-route.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement CAPI sender**

```ts
// lib/pixel/capi.ts
export async function sendCapiPurchase(input: {
  email: string; value: number; currency: string; eventId: string;
}): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return;
  const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`;
  const body = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_id: input.eventId,
      custom_data: { value: input.value, currency: input.currency },
    }],
  };
  await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
```

- [ ] **Step 4: Implement webhook route**

```ts
// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { stripe, PRICE_TO_PLAN } from "@/lib/stripe/client";
import { mapEventToMutation } from "@/lib/stripe/webhook";
import { upsertSubscription, mintRedeemToken } from "@/lib/db/subscriptions";
import { sendCapiPurchase } from "@/lib/pixel/capi";
import { randomUUID } from "node:crypto";

const REDEEM_TTL_MS = Number(process.env.REDEEM_TOKEN_TTL_MS ?? 7 * 86400_000);

export async function POST(request: Request): Promise<NextResponse> {
  const sig = request.headers.get("stripe-signature") ?? "";
  const raw = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const mutation = mapEventToMutation(event as any, PRICE_TO_PLAN);
  if (mutation.kind === "upsert") {
    await upsertSubscription(mutation.input);
  }

  if (event.type === "checkout.session.completed") {
    const o: any = event.data.object;
    const email = o?.metadata?.email ?? o?.customer_details?.email;
    if (email) {
      await mintRedeemToken(email, REDEEM_TTL_MS, randomUUID());
      await sendCapiPurchase({
        email,
        value: (o.amount_total ?? 0) / 100,
        currency: String(o.currency ?? "usd").toUpperCase(),
        eventId: event.id,
      });
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/pixel/__tests__/capi.test.ts app/api/stripe/webhook/__tests__/webhook-route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/pixel/capi.ts app/api/stripe/webhook/route.ts lib/pixel/__tests__/capi.test.ts app/api/stripe/webhook/__tests__/webhook-route.test.ts
git commit -m "Add Stripe webhook route with entitlement upsert, token mint, and CAPI Purchase"
```

---

### Task 7: Meta Pixel base + SPA PageView + typed events

**Files:**
- Create: `lib/pixel/events.ts`
- Create: `app/components/MetaPixel.tsx`
- Test: `lib/pixel/__tests__/events.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `track(event: PixelEvent, params?: Record<string, unknown>, eventId?: string): void` and `PixelEvent = 'PageView' | 'ViewContent' | 'Lead' | 'InitiateCheckout' | 'Purchase'`. `MetaPixel` component injects base code and fires `PageView` on `usePathname` change.

- [ ] **Step 1: Write the failing test**

```ts
// lib/pixel/__tests__/events.test.ts
import { vi, beforeEach } from "vitest";
import { track } from "@/lib/pixel/events";

beforeEach(() => { (globalThis as any).fbq = vi.fn(); });

describe("track", () => {
  it("forwards to fbq with event and params", () => {
    track("InitiateCheckout", { value: 4.99, currency: "USD" });
    expect((globalThis as any).fbq).toHaveBeenCalledWith("track", "InitiateCheckout", { value: 4.99, currency: "USD" });
  });
  it("passes eventID as the 4th arg when provided", () => {
    track("Purchase", { value: 4.99, currency: "USD" }, "evt_1");
    expect((globalThis as any).fbq).toHaveBeenCalledWith("track", "Purchase", { value: 4.99, currency: "USD" }, { eventID: "evt_1" });
  });
  it("no-ops safely when fbq is undefined", () => {
    (globalThis as any).fbq = undefined;
    expect(() => track("PageView")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/pixel/__tests__/events.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement events + component**

```ts
// lib/pixel/events.ts
export type PixelEvent = "PageView" | "ViewContent" | "Lead" | "InitiateCheckout" | "Purchase";

export function track(event: PixelEvent, params?: Record<string, unknown>, eventId?: string): void {
  const fbq = (globalThis as { fbq?: (...a: unknown[]) => void }).fbq;
  if (typeof fbq !== "function") return;
  if (eventId) fbq("track", event, params ?? {}, { eventID: eventId });
  else if (params) fbq("track", event, params);
  else fbq("track", event);
}
```

```tsx
// app/components/MetaPixel.tsx
"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { track } from "@/lib/pixel/events";

export function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const pathname = usePathname();
  useEffect(() => { if (pixelId) track("PageView"); }, [pathname, pixelId]);
  if (!pixelId) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">{`
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init','${pixelId}');fbq('track','PageView');
    `}</Script>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/pixel/__tests__/events.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pixel/events.ts app/components/MetaPixel.tsx lib/pixel/__tests__/events.test.ts
git commit -m "Add Meta Pixel base loader, SPA PageView, and typed track helper"
```

---

### Task 8: Funnel UI — landing, qualify, preview, paywall

**Files:**
- Create: `app/go/page.tsx`
- Create: `app/go/components/Funnel.tsx`
- Test: `app/go/__tests__/funnel.test.tsx`

**Interfaces:**
- Consumes: `FUNNEL_CONFIG`, `finePrint` (Task 2); `track` (Task 7); `POST /api/checkout` (Task 5).
- Produces: a client `Funnel` component that walks landing → qualify → preview → paywall, captures email, fires `ViewContent` on mount, `Lead` after email capture, `InitiateCheckout` on plan select, and POSTs to `/api/checkout` then redirects to `session.url`.

- [ ] **Step 1: Write the failing test**

```tsx
// app/go/__tests__/funnel.test.tsx
import { vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Funnel } from "@/app/go/components/Funnel";
import * as pixel from "@/lib/pixel/events";

const fetchMock = vi.fn(async () => ({ json: async () => ({ url: "https://checkout.test/s/1" }) }));
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => { fetchMock.mockClear(); vi.spyOn(pixel, "track").mockImplementation(() => {}); });

describe("Funnel", () => {
  it("shows the social-proof anchor and pricing on the paywall", async () => {
    render(<Funnel />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    // advance through the qualify + preview steps
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(screen.getByText(/12,000\+/)).toBeInTheDocument());
    expect(screen.getByText("$4.99")).toBeInTheDocument();
    expect(screen.getByText("$29.99")).toBeInTheDocument();
    expect(screen.getByText("Unlimited documents")).toBeInTheDocument();
  });

  it("fires Lead after email and InitiateCheckout on plan select, then redirects", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
    render(<Funnel />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(pixel.track).toHaveBeenCalledWith("Lead");
    fireEvent.click(await screen.findByRole("button", { name: /start.*4\.99/i }));
    expect(pixel.track).toHaveBeenCalledWith("InitiateCheckout", { value: 4.99, currency: "USD" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/go/__tests__/funnel.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the funnel component**

```tsx
// app/go/components/Funnel.tsx
"use client";
import { useEffect, useState } from "react";
import { FUNNEL_CONFIG, finePrint } from "@/lib/funnel/config";
import { track } from "@/lib/pixel/events";

type Step = "landing" | "qualify" | "paywall";

export function Funnel() {
  const [step, setStep] = useState<Step>("landing");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const count = FUNNEL_CONFIG.socialProofCount.toLocaleString();

  useEffect(() => { track("ViewContent"); }, []);

  async function startCheckout(plan: "weekly" | "annual") {
    const cents = FUNNEL_CONFIG.plans[plan].cents;
    track("InitiateCheckout", { value: cents / 100, currency: "USD" });
    setBusy(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan, email }),
    });
    const { url } = await res.json();
    if (url) window.location.assign(url);
    setBusy(false);
  }

  if (step === "landing") {
    return (
      <section>
        <h1>Turn any video or scan into a searchable PDF</h1>
        <p>Join {count}+ people scanning smarter.</p>
        <button onClick={() => setStep("qualify")}>Get started</button>
      </section>
    );
  }

  if (step === "qualify") {
    return (
      <section>
        <h2>What do you scan most?</h2>
        {/* light taps omitted for brevity in test; a single continue advances */}
        <label htmlFor="email">Your email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button
          onClick={() => { track("Lead"); setStep("paywall"); }}
        >Continue</button>
      </section>
    );
  }

  return (
    <section>
      <h2>Unlock Video2PDF Pro</h2>
      <p>Trusted by {count}+ people.</p>
      <ul>{FUNNEL_CONFIG.proBenefits.map((b) => <li key={b}>{b}</li>)}</ul>
      <button disabled={busy} onClick={() => startCheckout("weekly")}>
        Start: {FUNNEL_CONFIG.plans.weekly.trialDays}-day free trial, then {FUNNEL_CONFIG.plans.weekly.price}/week
      </button>
      <button disabled={busy} onClick={() => startCheckout("annual")}>
        Annual {FUNNEL_CONFIG.plans.annual.price}
      </button>
      <small>{finePrint(FUNNEL_CONFIG.plans.weekly.price, FUNNEL_CONFIG.plans.weekly.trialDays)}</small>
    </section>
  );
}
```

```tsx
// app/go/page.tsx
import { Funnel } from "./components/Funnel";
export default function GoPage() { return <Funnel />; }
```

Note: the qualify step in the test advances with a single "Continue"; the landing "Get started" then a "Continue" reach the paywall. The first `Continue` in the test targets the qualify step. Keep the button label "Continue" and the plan button label starting with "Start" containing "4.99" so the regex `start.*4\.99` matches.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/go/__tests__/funnel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/go/page.tsx app/go/components/Funnel.tsx app/go/__tests__/funnel.test.tsx
git commit -m "Add funnel UI: landing, qualify with email capture, and paywall"
```

---

### Task 9: Success / handoff page

**Files:**
- Create: `app/go/success/page.tsx`
- Create: `app/go/success/components/Handoff.tsx`
- Test: `app/go/success/__tests__/handoff.test.tsx`

**Interfaces:**
- Consumes: `FUNNEL_CONFIG` (deep-link scheme), `track` (Task 7).
- Produces: `Handoff` component that receives a `token` prop, renders the `video2pdf://redeem?token=…` deep link and a visible manual code, and fires the browser `Purchase` pixel once (value/currency from a `plan` prop, `eventId` from a prop so it dedups with CAPI).

- [ ] **Step 1: Write the failing test**

```tsx
// app/go/success/__tests__/handoff.test.tsx
import { vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Handoff } from "@/app/go/success/components/Handoff";
import * as pixel from "@/lib/pixel/events";

beforeEach(() => vi.spyOn(pixel, "track").mockImplementation(() => {}));

describe("Handoff", () => {
  it("renders the deep link and manual code", () => {
    render(<Handoff token="tok_abc" value={4.99} eventId="evt_9" />);
    const link = screen.getByRole("link", { name: /open the app/i });
    expect(link).toHaveAttribute("href", "video2pdf://redeem?token=tok_abc");
    expect(screen.getByText("tok_abc")).toBeInTheDocument();
  });
  it("fires Purchase with value, currency, and the dedup eventId", () => {
    render(<Handoff token="tok_abc" value={4.99} eventId="evt_9" />);
    expect(pixel.track).toHaveBeenCalledWith("Purchase", { value: 4.99, currency: "USD" }, "evt_9");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/go/success/__tests__/handoff.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement handoff**

```tsx
// app/go/success/components/Handoff.tsx
"use client";
import { useEffect, useRef } from "react";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";
import { track } from "@/lib/pixel/events";

export function Handoff(props: { token: string; value: number; eventId: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track("Purchase", { value: props.value, currency: "USD" }, props.eventId);
  }, [props.value, props.eventId]);

  const href = `${FUNNEL_CONFIG.deepLinkScheme}redeem?token=${props.token}`;
  return (
    <section>
      <h1>You are subscribed. Get the app.</h1>
      <a href={href}>Open the app</a>
      <p>If that does not open the app, enter this code in the app under "I already subscribed":</p>
      <code>{props.token}</code>
    </section>
  );
}
```

```tsx
// app/go/success/page.tsx
import { Handoff } from "./components/Handoff";
import { stripe } from "@/lib/stripe/client";

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  let token = "";
  let value = 0;
  let eventId = "";
  if (session_id) {
    const s = await stripe.checkout.sessions.retrieve(session_id);
    value = (s.amount_total ?? 0) / 100;
    eventId = typeof s.payment_intent === "string" ? s.payment_intent : session_id;
    // token is looked up by the app via redeem; surface the most recent token for this email
    token = (s.metadata?.redeem_token as string) ?? session_id;
  }
  return <Handoff token={token} value={value} eventId={eventId} />;
}
```

Note: to keep the success page free of a DB read, the webhook stores the minted token on the subscription's Stripe metadata as `redeem_token` in Task 6's `checkout.session.completed` branch. Add that write in Task 6 if not already present: `await stripe.subscriptions.update(o.subscription, { metadata: { redeem_token: token } })`. The `eventId` here MUST equal the one the CAPI Purchase used (Task 6 uses `event.id`); align both to the Checkout Session id to guarantee dedup: in Task 6 pass `eventId: o.id ?? event.id` and here use `session_id`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/go/success/__tests__/handoff.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Reconcile the dedup eventId (edit Task 6 route)**

In `app/api/stripe/webhook/route.ts`, in the `checkout.session.completed` branch, use the Checkout Session id as the dedup key and persist the token to subscription metadata:

```ts
const sessionId = o.id;
await mintRedeemToken(email, REDEEM_TTL_MS, token);
if (o.subscription) {
  await stripe.subscriptions.update(o.subscription, { metadata: { redeem_token: token, email } });
}
await sendCapiPurchase({ email, value: (o.amount_total ?? 0) / 100, currency: String(o.currency ?? "usd").toUpperCase(), eventId: sessionId });
```

(Where `token = randomUUID()` is generated just above.) Update the Task 6 webhook test's expected `eventId` from `"evt_9"` to the session object's `id` accordingly.

- [ ] **Step 6: Run the webhook test again to confirm still green**

Run: `npx vitest run app/api/stripe/webhook/__tests__/webhook-route.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/go/success/page.tsx app/go/success/components/Handoff.tsx app/go/success/__tests__/handoff.test.tsx app/api/stripe/webhook/route.ts app/api/stripe/webhook/__tests__/webhook-route.test.ts
git commit -m "Add success handoff page with deep link, code fallback, and deduped Purchase pixel"
```

---

### Task 10: Mount the pixel in the layout

**Files:**
- Modify: `app/layout.tsx` (add `<MetaPixel />`)
- Test: `app/__tests__/layout-pixel.test.tsx`

**Interfaces:**
- Consumes: `MetaPixel` (Task 7).
- Produces: pixel present on every page.

- [ ] **Step 1: Write the failing test**

```tsx
// app/__tests__/layout-pixel.test.tsx
import { render } from "@testing-library/react";
import { MetaPixel } from "@/app/components/MetaPixel";
import { vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/go" }));

describe("MetaPixel", () => {
  it("renders nothing when no pixel id is configured", () => {
    const { container } = render(<MetaPixel />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails / passes appropriately**

Run: `npx vitest run app/__tests__/layout-pixel.test.tsx`
Expected: PASS if `NEXT_PUBLIC_META_PIXEL_ID` unset (guard works). If it errors on `next/script`, add `vi.mock("next/script", () => ({ default: (p:any)=>p.children ?? null }))`.

- [ ] **Step 3: Add to layout**

In `app/layout.tsx`, import and render `<MetaPixel />` inside `<body>` before `{children}`:

```tsx
import { MetaPixel } from "@/app/components/MetaPixel";
// ... inside <body>:
<MetaPixel />
{children}
```

- [ ] **Step 4: Run the full site suite**

Run: `npm test`
Expected: PASS (all suites green).

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/__tests__/layout-pixel.test.tsx
git commit -m "Mount Meta Pixel site-wide"
```

---

### Task 11: Server DB reader

**Files (in `video2pdf-app/server`):**
- Create: `src/db/client.ts`
- Test: `src/db/client.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` env.
- Produces: `getSubscriptionByEmail(email: string): Promise<SubRow | null>`, `getRedeemToken(token: string): Promise<TokenRow | null>`, `consumeRedeemToken(token: string): Promise<void>`, with `SubRow`/`TokenRow` mirroring the site's shapes (camelCase, epoch ms). Uses `pg` Pool; tests mock the pool's `query`.

- [ ] **Step 1: Write the failing test**

```ts
// src/db/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
vi.mock("pg", () => ({ Pool: class { query = query; } }));

import { getSubscriptionByEmail, getRedeemToken } from "./client";

beforeEach(() => query.mockReset());

describe("getSubscriptionByEmail", () => {
  it("returns a mapped row or null", async () => {
    query.mockResolvedValueOnce({ rows: [{
      email: "a@b.com", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1",
      plan: "weekly", status: "active",
      current_period_end: new Date("2026-08-01T00:00:00Z"),
      trial_end: null, created_at: new Date(), updated_at: new Date(),
    }] });
    const row = await getSubscriptionByEmail("a@b.com");
    expect(row?.plan).toBe("weekly");
    expect(row?.status).toBe("active");
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getSubscriptionByEmail("none@b.com")).toBeNull();
  });
});

describe("getRedeemToken", () => {
  it("returns null for an unknown token", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getRedeemToken("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `server/`): `npx vitest run src/db/client.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the reader**

```ts
// src/db/client.ts
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

const ms = (v: unknown): number | null =>
  v == null ? null : v instanceof Date ? v.getTime() : Date.parse(String(v));

export interface SubRow {
  email: string; plan: "weekly" | "annual";
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodEnd: number | null; trialEnd: number | null;
}
export interface TokenRow {
  token: string; email: string; expiresAt: number; consumedAt: number | null;
}

export async function getSubscriptionByEmail(email: string): Promise<SubRow | null> {
  const { rows } = await pool.query(
    "SELECT email, plan, status, current_period_end, trial_end FROM subscriptions WHERE email = $1",
    [email],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    email: r.email, plan: r.plan, status: r.status,
    currentPeriodEnd: ms(r.current_period_end), trialEnd: ms(r.trial_end),
  };
}

export async function getRedeemToken(token: string): Promise<TokenRow | null> {
  const { rows } = await pool.query(
    "SELECT token, email, expires_at, consumed_at FROM redeem_tokens WHERE token = $1",
    [token],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return { token: r.token, email: r.email, expiresAt: ms(r.expires_at) ?? 0, consumedAt: ms(r.consumed_at) };
}

export async function consumeRedeemToken(token: string): Promise<void> {
  await pool.query("UPDATE redeem_tokens SET consumed_at = now() WHERE token = $1 AND consumed_at IS NULL", [token]);
}
```

- [ ] **Step 4: Add dependency, run test to verify it passes**

Run (from `server/`): `npm install pg && npm install -D @types/pg && npx vitest run src/db/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/client.ts server/src/db/client.test.ts server/package.json server/package-lock.json
git commit -m "Add server Postgres reader for web subscriptions and redeem tokens"
```

---

### Task 12: Web-entitlement normalizer (pure)

**Files (in `server/`):**
- Create: `src/services/webEntitlement.ts`
- Test: `src/services/webEntitlement.test.ts`

**Interfaces:**
- Consumes: `SubRow` (Task 11).
- Produces: `normalizeWebEntitlement(row: SubRow | null, now: number): WebEntitlement` where `WebEntitlement = { valid: boolean; plan: 'weekly' | 'annual' | null; status: string; expiresAt: number | null }`. Valid when `status` is `trialing`/`active`, or `past_due` still within `currentPeriodEnd` (grace).

- [ ] **Step 1: Write the failing test**

```ts
// src/services/webEntitlement.test.ts
import { describe, it, expect } from "vitest";
import { normalizeWebEntitlement } from "./webEntitlement";

const NOW = Date.parse("2026-07-23T00:00:00Z");
const FUTURE = Date.parse("2026-08-23T00:00:00Z");
const PAST = Date.parse("2026-07-01T00:00:00Z");

describe("normalizeWebEntitlement", () => {
  it("is valid while trialing", () => {
    expect(normalizeWebEntitlement({ email: "a", plan: "weekly", status: "trialing", currentPeriodEnd: FUTURE, trialEnd: FUTURE }, NOW).valid).toBe(true);
  });
  it("is valid while active", () => {
    expect(normalizeWebEntitlement({ email: "a", plan: "annual", status: "active", currentPeriodEnd: FUTURE, trialEnd: null }, NOW).valid).toBe(true);
  });
  it("is valid past_due within grace (period not ended)", () => {
    expect(normalizeWebEntitlement({ email: "a", plan: "weekly", status: "past_due", currentPeriodEnd: FUTURE, trialEnd: null }, NOW).valid).toBe(true);
  });
  it("is invalid past_due after period end", () => {
    expect(normalizeWebEntitlement({ email: "a", plan: "weekly", status: "past_due", currentPeriodEnd: PAST, trialEnd: null }, NOW).valid).toBe(false);
  });
  it("is invalid when canceled", () => {
    expect(normalizeWebEntitlement({ email: "a", plan: "weekly", status: "canceled", currentPeriodEnd: FUTURE, trialEnd: null }, NOW).valid).toBe(false);
  });
  it("is invalid for a null row", () => {
    const e = normalizeWebEntitlement(null, NOW);
    expect(e.valid).toBe(false);
    expect(e.plan).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `server/`): `npx vitest run src/services/webEntitlement.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the normalizer**

```ts
// src/services/webEntitlement.ts
import type { SubRow } from "../db/client";

export interface WebEntitlement {
  valid: boolean;
  plan: "weekly" | "annual" | null;
  status: string;
  expiresAt: number | null;
}

export function normalizeWebEntitlement(row: SubRow | null, now: number): WebEntitlement {
  if (!row) return { valid: false, plan: null, status: "none", expiresAt: null };
  const withinPeriod = row.currentPeriodEnd != null && row.currentPeriodEnd > now;
  const valid =
    row.status === "trialing" ||
    row.status === "active" ||
    (row.status === "past_due" && withinPeriod);
  return { valid, plan: row.plan, status: row.status, expiresAt: row.currentPeriodEnd };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `server/`): `npx vitest run src/services/webEntitlement.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/webEntitlement.ts server/src/services/webEntitlement.test.ts
git commit -m "Add pure web-entitlement normalizer with grace-period handling"
```

---

### Task 13: redeem + web-entitlement routes, mounted

**Files (in `server/`):**
- Create: `src/routes/redeem.ts`
- Create: `src/routes/webEntitlement.ts`
- Modify: `src/index.ts` (mount both)
- Test: `src/routes/redeem.test.ts`
- Test: `src/routes/webEntitlement.test.ts`

**Interfaces:**
- Consumes: `getSubscriptionByEmail`, `getRedeemToken`, `consumeRedeemToken` (Task 11), `normalizeWebEntitlement` (Task 12).
- Produces:
  - `POST /api/v1/redeem` `{ token }` → 200 `{ valid, email, plan, status, expiresAt }`, 400 missing token, 404 unknown, 410 expired/consumed.
  - `POST /api/v1/web-entitlement` `{ email }` → 200 `{ valid, plan, status, expiresAt }`, 400 missing email.

- [ ] **Step 1: Write the failing tests**

```ts
// src/routes/redeem.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const getRedeemToken = vi.fn();
const consumeRedeemToken = vi.fn(async () => {});
const getSubscriptionByEmail = vi.fn();
vi.mock("../db/client", () => ({ getRedeemToken, consumeRedeemToken, getSubscriptionByEmail }));

import redeemRouter from "./redeem";
const app = express().use(express.json()).use("/api/v1/redeem", redeemRouter);

beforeEach(() => { getRedeemToken.mockReset(); consumeRedeemToken.mockClear(); getSubscriptionByEmail.mockReset(); });

describe("POST /api/v1/redeem", () => {
  it("400s without a token", async () => {
    const res = await request(app).post("/api/v1/redeem").send({});
    expect(res.status).toBe(400);
  });
  it("404s for an unknown token", async () => {
    getRedeemToken.mockResolvedValueOnce(null);
    const res = await request(app).post("/api/v1/redeem").send({ token: "nope" });
    expect(res.status).toBe(404);
  });
  it("410s for an expired token", async () => {
    getRedeemToken.mockResolvedValueOnce({ token: "t", email: "a@b.com", expiresAt: Date.parse("2000-01-01"), consumedAt: null });
    const res = await request(app).post("/api/v1/redeem").send({ token: "t" });
    expect(res.status).toBe(410);
  });
  it("grants and consumes a valid token", async () => {
    getRedeemToken.mockResolvedValueOnce({ token: "t", email: "a@b.com", expiresAt: Date.now() + 1e6, consumedAt: null });
    getSubscriptionByEmail.mockResolvedValueOnce({ email: "a@b.com", plan: "weekly", status: "active", currentPeriodEnd: Date.now() + 1e9, trialEnd: null });
    const res = await request(app).post("/api/v1/redeem").send({ token: "t" });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.email).toBe("a@b.com");
    expect(consumeRedeemToken).toHaveBeenCalledWith("t");
  });
});
```

```ts
// src/routes/webEntitlement.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const getSubscriptionByEmail = vi.fn();
vi.mock("../db/client", () => ({ getSubscriptionByEmail }));

import router from "./webEntitlement";
const app = express().use(express.json()).use("/api/v1/web-entitlement", router);

beforeEach(() => getSubscriptionByEmail.mockReset());

describe("POST /api/v1/web-entitlement", () => {
  it("400s without an email", async () => {
    const res = await request(app).post("/api/v1/web-entitlement").send({});
    expect(res.status).toBe(400);
  });
  it("returns valid entitlement for an active email", async () => {
    getSubscriptionByEmail.mockResolvedValueOnce({ email: "a@b.com", plan: "annual", status: "active", currentPeriodEnd: Date.now() + 1e9, trialEnd: null });
    const res = await request(app).post("/api/v1/web-entitlement").send({ email: "a@b.com" });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.plan).toBe("annual");
  });
  it("returns invalid for an unknown email", async () => {
    getSubscriptionByEmail.mockResolvedValueOnce(null);
    const res = await request(app).post("/api/v1/web-entitlement").send({ email: "x@b.com" });
    expect(res.body.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `server/`): `npx vitest run src/routes/redeem.test.ts src/routes/webEntitlement.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement routes**

```ts
// src/routes/redeem.ts
import { Request, Response, Router } from "express";
import { getRedeemToken, consumeRedeemToken, getSubscriptionByEmail } from "../db/client";
import { normalizeWebEntitlement } from "../services/webEntitlement";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { token } = req.body ?? {};
  if (!token || typeof token !== "string") return res.status(400).json({ error: "Missing token" });
  const row = await getRedeemToken(token);
  if (!row) return res.status(404).json({ error: "Unknown token" });
  if (row.consumedAt || row.expiresAt < Date.now()) return res.status(410).json({ error: "Token expired or already used" });
  const sub = await getSubscriptionByEmail(row.email);
  const ent = normalizeWebEntitlement(sub, Date.now());
  await consumeRedeemToken(token);
  return res.status(200).json({ ...ent, email: row.email });
});

export default router;
```

```ts
// src/routes/webEntitlement.ts
import { Request, Response, Router } from "express";
import { getSubscriptionByEmail } from "../db/client";
import { normalizeWebEntitlement } from "../services/webEntitlement";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") return res.status(400).json({ error: "Missing email" });
  const sub = await getSubscriptionByEmail(email);
  return res.status(200).json(normalizeWebEntitlement(sub, Date.now()));
});

export default router;
```

- [ ] **Step 4: Mount in `src/index.ts`**

Add alongside the existing route mounts (after `validate-receipt`):

```ts
import redeemRouter from "./routes/redeem";
import webEntitlementRouter from "./routes/webEntitlement";
// ...
app.use("/api/v1/redeem", redeemRouter);
app.use("/api/v1/web-entitlement", webEntitlementRouter);
```

- [ ] **Step 5: Add supertest, run tests to verify they pass**

Run (from `server/`): `npm install -D supertest @types/supertest && npx vitest run src/routes/redeem.test.ts src/routes/webEntitlement.test.ts`
Expected: PASS (7 tests). Then `npm test` for the whole server suite.

Note: `server/` currently has no `vitest.config`; if `npx vitest` fails to pick up TS, add a minimal `server/vitest.config.ts` (`import { defineConfig } from "vitest/config"; export default defineConfig({ test: { environment: "node" } });`) in this step and commit it too.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/redeem.ts server/src/routes/webEntitlement.ts server/src/index.ts server/src/routes/redeem.test.ts server/src/routes/webEntitlement.test.ts server/package.json server/package-lock.json
git commit -m "Add redeem and web-entitlement endpoints and mount them"
```

---

### Task 14: App web-entitlement client

**Files (in `video2pdf-app`):**
- Create: `src/services/webEntitlementClient.ts`
- Test: `src/services/webEntitlementClient.test.ts`

**Interfaces:**
- Consumes: the two server endpoints (Task 13).
- Produces:
  - `redeemToken(token: string): Promise<{ valid: boolean; email: string | null; plan: string | null; expiresAt: number | null }>`
  - `checkWebEntitlement(email: string): Promise<{ valid: boolean; plan: string | null; expiresAt: number | null }>`
  - `storeWebEmail(email: string): Promise<void>` / `getStoredWebEmail(): Promise<string | null>` (AsyncStorage key `v2p.web.email`).

- [ ] **Step 1: Write the failing test**

```ts
// src/services/webEntitlementClient.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const store: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => store[k] ?? null),
    setItem: vi.fn(async (k: string, v: string) => { store[k] = v; }),
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { redeemToken, checkWebEntitlement, storeWebEmail, getStoredWebEmail } from "./webEntitlementClient";

beforeEach(() => { fetchMock.mockReset(); for (const k of Object.keys(store)) delete store[k]; });

describe("redeemToken", () => {
  it("posts the token and returns normalized result", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ valid: true, email: "a@b.com", plan: "weekly", status: "active", expiresAt: 123 }) });
    const r = await redeemToken("tok_1");
    expect(r.valid).toBe(true);
    expect(r.email).toBe("a@b.com");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/redeem");
    expect(JSON.parse((init as any).body).token).toBe("tok_1");
  });
});

describe("checkWebEntitlement", () => {
  it("returns invalid on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    const r = await checkWebEntitlement("a@b.com");
    expect(r.valid).toBe(false);
  });
});

describe("email storage", () => {
  it("round-trips the stored email", async () => {
    await storeWebEmail("a@b.com");
    expect(await getStoredWebEmail()).toBe("a@b.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from app root): `npx vitest run src/services/webEntitlementClient.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement client**

```ts
// src/services/webEntitlementClient.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "https://api.video2pdf.ai/api/v1";
const EMAIL_KEY = "v2p.web.email";

export interface RedeemResult { valid: boolean; email: string | null; plan: string | null; expiresAt: number | null }
export interface EntitlementResult { valid: boolean; plan: string | null; expiresAt: number | null }

export async function redeemToken(token: string): Promise<RedeemResult> {
  try {
    const res = await fetch(`${API_BASE}/redeem`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return { valid: false, email: null, plan: null, expiresAt: null };
    const j = await res.json();
    return { valid: !!j.valid, email: j.email ?? null, plan: j.plan ?? null, expiresAt: j.expiresAt ?? null };
  } catch {
    return { valid: false, email: null, plan: null, expiresAt: null };
  }
}

export async function checkWebEntitlement(email: string): Promise<EntitlementResult> {
  try {
    const res = await fetch(`${API_BASE}/web-entitlement`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return { valid: false, plan: null, expiresAt: null };
    const j = await res.json();
    return { valid: !!j.valid, plan: j.plan ?? null, expiresAt: j.expiresAt ?? null };
  } catch {
    return { valid: false, plan: null, expiresAt: null };
  }
}

export async function storeWebEmail(email: string): Promise<void> {
  await AsyncStorage.setItem(EMAIL_KEY, email);
}
export async function getStoredWebEmail(): Promise<string | null> {
  return AsyncStorage.getItem(EMAIL_KEY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from app root): `npx vitest run src/services/webEntitlementClient.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/webEntitlementClient.ts src/services/webEntitlementClient.test.ts
git commit -m "Add app client for web redeem and entitlement checks"
```

---

### Task 15: Resolver branch — web entitlement grants Pro

**Files (in `video2pdf-app`):**
- Create: `src/services/accessMode.webSource.test.ts` (new focused test; follows existing `accessMode.test.ts`)
- Modify: `src/services/subscriptionEntitlement.ts` (add a web-source applier)

**Interfaces:**
- Consumes: `EntitlementResult` (Task 14), existing `SubscriptionStateSnapshot` and `createDefaultSubscriptionState` (verified present in `subscriptionEntitlement.ts`).
- Produces: `applyWebEntitlement(state: SubscriptionStateSnapshot, web: { valid: boolean; plan: string | null; expiresAt: number | null }, validatedAt: number): SubscriptionStateSnapshot` — sets `tier: 'pro'`, `entitlementStatus: 'active'`, `receiptSource: 'web'`, `expiresAt` when `web.valid`; otherwise returns state unchanged so a store receipt can still win.

Note: verify the `SubscriptionReceiptSource` type accepts `'web'`; if it does not, extend that union in `src/types/index.ts` as part of this task (add `| "web"`), which is a required, in-scope change for the branch.

- [ ] **Step 1: Write the failing test**

```ts
// src/services/accessMode.webSource.test.ts
import { describe, it, expect } from "vitest";
import { createDefaultSubscriptionState, applyWebEntitlement } from "./subscriptionEntitlement";

describe("applyWebEntitlement", () => {
  it("grants pro when the web entitlement is valid", () => {
    const s = applyWebEntitlement(createDefaultSubscriptionState(), { valid: true, plan: "weekly", expiresAt: 999 }, 1);
    expect(s.tier).toBe("pro");
    expect(s.entitlementStatus).toBe("active");
    expect(s.receiptSource).toBe("web");
    expect(s.expiresAt).toBe(999);
  });
  it("leaves state unchanged when the web entitlement is invalid", () => {
    const base = createDefaultSubscriptionState();
    const s = applyWebEntitlement(base, { valid: false, plan: null, expiresAt: null }, 1);
    expect(s.tier).toBe(base.tier);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from app root): `npx vitest run src/services/accessMode.webSource.test.ts`
Expected: FAIL (`applyWebEntitlement` not exported).

- [ ] **Step 3: Implement the applier**

Add to `src/services/subscriptionEntitlement.ts`:

```ts
export function applyWebEntitlement(
  state: SubscriptionStateSnapshot,
  web: { valid: boolean; plan: string | null; expiresAt: number | null },
  validatedAt: number,
): SubscriptionStateSnapshot {
  if (!web.valid) return state;
  return {
    ...state,
    entitlementStatus: "active",
    tier: "pro",
    receiptSource: "web",
    expiresAt: web.expiresAt,
    lastValidatedAt: validatedAt,
  };
}
```

If `receiptSource: "web"` is a type error, add `| "web"` to `SubscriptionReceiptSource` in `src/types/index.ts` first.

- [ ] **Step 4: Run test to verify it passes**

Run (from app root): `npx vitest run src/services/accessMode.webSource.test.ts`
Expected: PASS (2 tests). Then `npm test` for the whole app suite to confirm no regression.

- [ ] **Step 5: Commit**

```bash
git add src/services/subscriptionEntitlement.ts src/services/accessMode.webSource.test.ts src/types/index.ts
git commit -m "Grant Pro from a valid web entitlement without overriding store receipts"
```

---

### Task 16: Redeem screen + deep-link routing

**Files (in `video2pdf-app`):**
- Create: `src/screens/RedeemScreen.tsx`
- Create: `src/screens/redeemFlow.ts` (pure flow logic)
- Test: `src/screens/redeemFlow.test.ts`
- Modify: deep-link handling to route `video2pdf://redeem?token=…` to the redeem flow (in the existing Linking handler; `AppNavigator.tsx` or the app root that already imports `Linking`).

**Interfaces:**
- Consumes: `redeemToken`, `checkWebEntitlement`, `storeWebEmail` (Task 14); `applyWebEntitlement` (Task 15).
- Produces: `parseRedeemUrl(url: string): string | null` (extracts `token`), and `runRedeem(token: string, deps): Promise<{ unlocked: boolean }>` that redeems, stores email on success, and applies entitlement. Screen offers both code entry and email restore.

- [ ] **Step 1: Write the failing test**

```ts
// src/screens/redeemFlow.test.ts
import { describe, it, expect, vi } from "vitest";
import { parseRedeemUrl, runRedeem } from "./redeemFlow";

describe("parseRedeemUrl", () => {
  it("extracts the token from a deep link", () => {
    expect(parseRedeemUrl("video2pdf://redeem?token=tok_abc")).toBe("tok_abc");
  });
  it("returns null when no token", () => {
    expect(parseRedeemUrl("video2pdf://redeem")).toBeNull();
  });
});

describe("runRedeem", () => {
  it("stores email and reports unlocked on a valid token", async () => {
    const deps = {
      redeemToken: vi.fn(async () => ({ valid: true, email: "a@b.com", plan: "weekly", expiresAt: 9 })),
      storeWebEmail: vi.fn(async () => {}),
      onGrant: vi.fn(),
    };
    const r = await runRedeem("tok_abc", deps);
    expect(r.unlocked).toBe(true);
    expect(deps.storeWebEmail).toHaveBeenCalledWith("a@b.com");
    expect(deps.onGrant).toHaveBeenCalledWith({ valid: true, plan: "weekly", expiresAt: 9 });
  });
  it("reports not unlocked on an invalid token", async () => {
    const deps = {
      redeemToken: vi.fn(async () => ({ valid: false, email: null, plan: null, expiresAt: null })),
      storeWebEmail: vi.fn(async () => {}),
      onGrant: vi.fn(),
    };
    const r = await runRedeem("bad", deps);
    expect(r.unlocked).toBe(false);
    expect(deps.storeWebEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from app root): `npx vitest run src/screens/redeemFlow.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the pure flow**

```ts
// src/screens/redeemFlow.ts
import type { RedeemResult } from "../services/webEntitlementClient";

export function parseRedeemUrl(url: string): string | null {
  const m = url.match(/[?&]token=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export interface RunRedeemDeps {
  redeemToken: (token: string) => Promise<RedeemResult>;
  storeWebEmail: (email: string) => Promise<void>;
  onGrant: (web: { valid: boolean; plan: string | null; expiresAt: number | null }) => void;
}

export async function runRedeem(token: string, deps: RunRedeemDeps): Promise<{ unlocked: boolean }> {
  const r = await deps.redeemToken(token);
  if (!r.valid) return { unlocked: false };
  if (r.email) await deps.storeWebEmail(r.email);
  deps.onGrant({ valid: true, plan: r.plan, expiresAt: r.expiresAt });
  return { unlocked: true };
}
```

- [ ] **Step 4: Implement the screen + wire deep link**

Create `RedeemScreen.tsx` with a code `TextInput` (calls `runRedeem`) and an email `TextInput` (calls `checkWebEntitlement` then `applyWebEntitlement`, storing the email). In the existing Linking handler, on an initial/again URL matching `redeem`, call `parseRedeemUrl` and route to the redeem flow. Follow the existing screen and navigation patterns (`src/screens/*` + `AppNavigator.tsx`). Register `RedeemScreen` as a route.

- [ ] **Step 5: Run test to verify it passes + full suite**

Run (from app root): `npx vitest run src/screens/redeemFlow.test.ts && npm test`
Expected: PASS (all green).

- [ ] **Step 6: Commit**

```bash
git add src/screens/RedeemScreen.tsx src/screens/redeemFlow.ts src/screens/redeemFlow.test.ts src/navigation/AppNavigator.tsx
git commit -m "Add redeem screen and deep-link routing for web subscribers"
```

---

## Post-implementation (manual, outside TDD)

These are launch-config steps, not code, tracked here so they are not forgotten:

- [ ] Create the two Stripe recurring Prices ($4.99/week with 3-day trial via the checkout param, $29.99/year) in the live account; set `STRIPE_PRICE_WEEKLY`/`STRIPE_PRICE_ANNUAL`.
- [ ] Register the Stripe webhook endpoint (`/api/stripe/webhook`) and set `STRIPE_WEBHOOK_SECRET`. Set the endpoint's API version to `2026-06-24.dahlia` to match the installed `stripe` v22 SDK (the code pins this literal).
- [ ] Provision Vercel Postgres; run `lib/db/schema.sql`; set `POSTGRES_*` on the site and `DATABASE_URL` on the `server/` deploy.
- [ ] Set `NEXT_PUBLIC_META_PIXEL_ID`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`.
- [ ] E2E test-mode pass: purchase (weekly + annual) → webhook via Stripe CLI → deep link opens app and unlocks → new-device email restore → cancel via test clock revokes at period end.
- [ ] Point one ad set at `/go` and confirm Pixel + CAPI events land in Events Manager with deduped Purchase.

---

## Self-Review

**Spec coverage:** funnel (Tasks 8–9), Stripe web billing matching app pricing + trial (Tasks 4–6), Meta Pixel + CAPI dedup (Tasks 6, 7, 9), Vercel Postgres schema (Task 1), email-keyed bridge with disposable tokens (Tasks 3, 11, 13), endpoint split site-writes/server-reads (Tasks 6 vs 11–13), app redeem + email restore + resolver branch (Tasks 14–16), deep link with code fallback (Tasks 9, 16), error/edge cases (grace period Task 12, idempotent upsert Task 3, token expiry/consume Task 13, fail-closed clients Task 14). All spec sections map to tasks.

**Placeholder scan:** every code step contains full code; commands have expected output; no TBD/TODO left in task bodies (the "post-implementation" list is intentionally manual launch config, not code).

**Type consistency:** `SubscriptionRow`/`SubRow` shapes are consistent (site camelCase in Task 1; server mirrors in Task 11). `mapEventToMutation`/`SubscriptionMutation` names match across Tasks 4/6. `redeemToken`/`checkWebEntitlement`/`storeWebEmail` names are identical across Tasks 14/16. `applyWebEntitlement` signature matches across Tasks 15/16. The dedup `eventId` is reconciled to the Checkout Session id in Task 9 Step 5 (aligning Task 6 and Task 9). `receiptSource: 'web'` type extension is called out in Task 15.
