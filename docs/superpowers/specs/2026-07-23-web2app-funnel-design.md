# Web2App Subscription Funnel + Meta Pixel — Design Spec

- **Date:** 2026-07-23
- **Issue:** video2pdf-site#2 "Build subscription funnel landing page (Zellify-style) + Meta Pixel"
- **Status:** Approved design, ready for implementation planning
- **Repos touched:** `video2pdf-site` (funnel + checkout + webhook), `video2pdf-app/server` (app-facing entitlement endpoints), `video2pdf-app` (small redeem/restore path)

---

## 1. Goal

Build the paid-ad landing pipeline: a Zellify-style **web2app funnel** that converts ad
traffic into **paying subscribers on the web (Stripe) before they reach the App Store**,
then hands them off to the app already subscribed. Instrument the whole path with the
**Meta Pixel** (browser) + **Conversions API** (server) for attribution.

This is the true web-checkout model (charge on web, bypass the ~30% store cut, get
full-funnel Pixel attribution through `Purchase`), not the lighter "warm then buy via
in-app IAP" model.

### Non-goals (v1)

- No full user-account system in the app (it stays account-free; see §4).
- No web-exclusive discount — web pricing **matches** store pricing (§3).
- No medium/long quiz — utility apps convert better on a short landing→paywall (§2).
- No A/B variant engine in v1 (funnel is built so a variant can be added later).
- No change to the existing store-receipt IAP path; web billing is strictly additive.

---

## 2. Funnel (site)

Short, high-intent funnel appropriate for a utility app. Lives under a dedicated route
(e.g. `/go`) so ads point at it and it stays separate from the marketing/dashboard site.

Steps, top to bottom:

1. **Landing** — hero that matches the ad promise ("Turn any video or scan into a
   searchable PDF"), primary CTA, and the **"Join 12,000+ people"** social-proof anchor.
2. **Qualify (2–4 light taps)** — e.g. "What do you scan?" (documents / whiteboards /
   receipts / books), "How often?" — used only to lightly personalize the value preview
   and paywall framing. No long questionnaire. **Email is captured here or on the paywall**
   (before Checkout) since it is the permanent restore key (§4); Stripe Checkout also
   collects it, but capturing it in-funnel lets us fire `Lead` and pre-fill Checkout.
3. **Value preview** — a short "here's what you get" moment (sample before/after, the
   three Pro benefits below), framed as "ready to unlock", not "start from scratch".
4. **Paywall** — mirrors the app's real offering exactly:
   - **Weekly $4.99** with **3-day free trial**
   - **Annual $29.99**
   - Pro benefits (verbatim from app `subscriptionCatalog.ts`): **Full-resolution
     scans**, **Searchable, copyable PDFs**, **Unlimited documents**.
   - Trust block: 12,000+ users, cancel-anytime, trial fine print matching the app's
     (`3-day free trial if eligible; then <price>, charged automatically unless canceled
     24h before renewal`).
5. **Stripe Checkout (hosted)** — see §3.
6. **App handoff** — success page with the deep link + redemption code (§4).

**Social proof:** the **12,000 users** figure is the anchor and appears on the landing,
paywall, and handoff. (Configurable constant so it can be bumped over time.)

### Pixel events fired along the funnel

Browser Pixel (`fbq`), with a server-side Conversions API mirror for `Purchase`
(dedup via shared `eventID`):

| Step | Event |
|------|-------|
| Landing view | `PageView` (auto) + `ViewContent` |
| Qualify complete / email captured | `Lead` |
| Paywall → checkout click | `InitiateCheckout` |
| Purchase confirmed | `Purchase` `{ value, currency: 'USD' }` (browser + CAPI, same `eventID`) |

SPA route changes fire the corresponding `fbq('track', …)` manually (Next.js App Router
navigation does not reload the page, so `PageView` must be fired on route change).

---

## 3. Web billing (Stripe, on the site)

Stripe-hosted Checkout in **subscription mode**, matching store pricing:

- Two Stripe recurring **Prices** created to mirror the app: **$4.99/week** and
  **$29.99/year**. The weekly price/session sets **`subscription_data.trial_period_days
  = 3`** to mirror the app's 3-day trial. (Store product IDs for reference:
  `com.video2pdf.pro.weekly` / `com.video2pdf.pro.annual`, Google
  `video2pdf_pro_weekly` / `video2pdf_pro_annual` — the Stripe prices are separate
  objects, not the same IDs.)
- **`POST /api/checkout`** (site route) creates a Checkout Session:
  `mode: 'subscription'`, `customer_email` (captured in the funnel — this is the
  permanent restore key, §4), the selected `price`, `success_url` →
  `/go/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url` → back to the paywall.
- **`POST /api/stripe/webhook`** (site route) verifies the Stripe signature and updates
  Postgres on these lifecycle events:

  | Event | Action on `subscriptions` |
  |-------|---------------------------|
  | `checkout.session.completed` | Upsert row from session (email, customer, subscription id); mint a `redeem_token`. |
  | `customer.subscription.created` | Set `status` (`trialing`/`active`), `plan`, `current_period_end`, `trial_end`. Grant. |
  | `customer.subscription.updated` | Update `status`/`plan`/`current_period_end` (plan change, trial→active, past_due). |
  | `customer.subscription.deleted` | Set `status = canceled`. Revoke at period end. |
  | `invoice.paid` | Renewal — keep active, bump `current_period_end`. |
  | `invoice.payment_failed` | Mark `past_due`; revoke after grace (entitlement check keys off `status` + `current_period_end`). |

Entitlement truth for web subs = the Postgres row's `status` + `current_period_end`,
maintained entirely by these webhooks. Stripe keys and webhook secret live only in the
site's Vercel env (single origin with the checkout).

---

## 4. The entitlement bridge (the hard part)

**Constraint (verified in code):** the app has **no user accounts** and the backend
(`video2pdf-app/server`, Express) is **stateless with no database** — entitlement today
is a local, receipt-based state validated against `POST /api/v1/validate-receipt`.
"Restore Purchases" reads the store's own transaction history via `expo-iap`. A web
Stripe purchase has no store transaction, so it needs its own unlock + restore path.

### Identity model

- **Email = permanent restore key.** Captured at checkout. Every future device restores
  by email.
- **Redemption token = disposable unlock credential.** One minted at purchase (embedded
  in the handoff deep link / shown as a code) for frictionless first unlock. More can be
  minted on demand for new-device restore. Tokens expire and are single-use
  (`consumed_at`).

### Datastore — **Vercel Postgres** (new; greenfield)

The site is on Vercel with no DB today and the server has none, so this is the first
persistence layer, added only for web subs. Two tables:

- **`subscriptions`**: `email` (PK), `stripe_customer_id`, `stripe_subscription_id`,
  `plan` (`weekly`|`annual`), `status` (`trialing`|`active`|`past_due`|`canceled`),
  `current_period_end`, `trial_end`, `created_at`, `updated_at`.
- **`redeem_tokens`**: `token` (PK, opaque random), `email` (FK), `created_at`,
  `expires_at`, `consumed_at` (nullable).

### Endpoint placement — split by ownership

- **Site (Vercel):** `POST /api/checkout`, `POST /api/stripe/webhook`. The site **writes**
  Postgres (webhook is the only writer). Co-located with the checkout + Stripe env.
- **`server/` (`api.video2pdf.ai`, Express):** two new app-facing endpoints alongside
  `validate-receipt`, which **read** Postgres over a `DATABASE_URL` connection string
  (server is a Docker deploy, reaches Vercel Postgres as an external Postgres):
  - **`POST /api/v1/redeem`** `{ token }` → validates + consumes the token, returns
    normalized web entitlement `{ valid, plan, status, expiresAt }`. Returns the
    associated `email` so the app can store it for future restores.
  - **`POST /api/v1/web-entitlement`** `{ email }` (or a stored session token) → returns
    current web entitlement for that email; also the **restore** path (can trigger a
    fresh magic-link email if desired). Used both for new-device restore and for the
    app's periodic re-check.

Rationale: the **app already calls only `api.video2pdf.ai`** for entitlement
(`validate-receipt`, `app-version`), so app-facing entitlement stays on that one origin;
the webhook stays with the checkout it belongs to. One DB, site writes, server reads.

### App changes (kept minimal, additive)

- Handoff deep link uses the app's existing custom scheme **`video2pdf://`** (bundle/
  package `com.vid2pdf.app`; no universal/associated-domains links configured today), e.g.
  `video2pdf://redeem?token=…`. **Manual code entry is the fallback** when the deep link
  fails to open the app (no universal links yet, so a fallback is required, not optional).
- New lightweight **"Redeem / I already subscribed"** path: enter code or arrive via deep
  link → calls `POST /api/v1/redeem` → on success stores a web-entitlement marker + email
  locally and unlocks Pro.
- The entitlement resolver (`subscriptionEntitlement.ts` / `iapService.ts`) gains **one
  branch**: if a web-entitlement marker is held, re-check `web-entitlement` on the same
  cadence it re-validates receipts. Whichever source (store receipt OR web) grants Pro
  wins. No change to the existing receipt path.
- **Restore on a new device:** user taps restore, enters email → `web-entitlement` →
  unlock. Email is the durable key; no account/login is introduced.

---

## 5. Data flow (end to end)

```
Meta ad
  → SITE /go  (Pixel: ViewContent → Lead → InitiateCheckout)
  → POST /api/checkout → Stripe Checkout (subscription, email, trial=3d on weekly)
  → Stripe → POST /api/stripe/webhook → Vercel Postgres (upsert sub + mint token)
  → /go/success (Pixel + CAPI: Purchase {value,currency}, shared eventID)
     shows video2pdf://redeem?token=… deep link + manual code
  → APP redeem path → POST /api/v1/redeem (server reads Postgres) → unlock Pro
  → APP stores email; periodic POST /api/v1/web-entitlement re-check
New device: APP restore → enter email → POST /api/v1/web-entitlement → unlock
Renewal/cancel: Stripe webhook updates Postgres; app re-check reflects it
```

---

## 6. Error handling & edge cases

- **Webhook idempotency:** upserts keyed by email/subscription id; safe to replay
  (Stripe retries). Verify Stripe signature; reject unsigned.
- **Deep link fails to open app:** manual code entry fallback on the success page and in
  the app (required, since no universal links yet).
- **Token expired/consumed on new device:** app falls back to email restore
  (`web-entitlement`), which can re-mint/email a fresh token.
- **Payment failed at renewal:** `invoice.payment_failed` → `past_due`; entitlement check
  treats access as valid until `current_period_end`, then revokes (grace period).
- **Same email buys twice / already subscribed:** `subscriptions.email` PK → upsert, no
  duplicate; funnel can detect an existing active sub and route to restore instead.
- **DB unreachable from server:** `redeem`/`web-entitlement` fail closed with a clear
  retry message; the app keeps any last-known-good local entitlement until its next
  successful re-check (mirrors current receipt-revalidation resilience).
- **Store IAP buyer who also hits the funnel:** two independent truths; either granting
  Pro is sufficient. No conflict.

---

## 7. Testing

- **Site:** unit-test `/api/checkout` session params (mode, email, trial on weekly,
  URLs); webhook handler per event type → correct Postgres mutation (with Stripe fixture
  events); Pixel event firing on each funnel step (including SPA route-change PageView);
  CAPI `Purchase` sends matching `eventID`.
- **server/:** `redeem` (valid, expired, already-consumed, unknown token);
  `web-entitlement` (active, trialing, past_due within grace, canceled/expired, unknown
  email). Follows existing `validate.test.ts` / `appVersion.test.ts` patterns.
- **App:** resolver picks the correct source when only web / only receipt / both present;
  redeem-then-unlock; email restore on a fresh install.
- **Manual/E2E:** Stripe test-mode purchase → webhook (Stripe CLI) → deep link → app
  unlock; new-device email restore; renewal + cancellation via test clock.

---

## 8. Environment / config additions

- **Site (Vercel):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_WEEKLY`, `STRIPE_PRICE_ANNUAL`, `NEXT_PUBLIC_META_PIXEL_ID`,
  `META_CAPI_ACCESS_TOKEN`, `POSTGRES_*` (Vercel Postgres), `NEXT_PUBLIC_APP_DEEP_LINK`
  (`video2pdf://`).
- **server/:** `DATABASE_URL` (Vercel Postgres connection string), `REDEEM_TOKEN_TTL`.
- **App:** funnel/handoff URL + deep-link route registration (scheme already
  `video2pdf`).

---

## 9. Open items to pin before launch (not blockers to plan)

- Exact copy for landing hero + qualify questions (aligned to live ad creatives).
- Final `value` sent to `Purchase`/CAPI per plan ($4.99 vs $29.99).
- Whether `web-entitlement` auto-emails a magic link on restore, or just returns status
  and the app shows the code path.
- Vercel Postgres region + connection pooling for the Docker `server/` reader.
