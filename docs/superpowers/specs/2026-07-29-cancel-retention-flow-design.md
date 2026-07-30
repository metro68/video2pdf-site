# Web Cancellation Retention Flow

Date: 2026-07-29
Repo: video2pdf-site
Status: approved design, pending implementation plan

## Overview

Today /manage collects an email and redirects straight into Stripe's hosted billing portal, where cancellation is one click. We get no retention attempt and no churn data. This project replaces the portal cancel path with a site-owned, multi-step cancellation flow that shows subscribers what they lose, makes a plan-specific save offer, and only then completes the cancellation. The Stripe portal remains for payment method updates only.

Scope is the web (Stripe) subscriber base only. App Store and Play subscribers cancel through their store settings and are untouched.

## Goals

- Convert a meaningful share of cancel attempts into saves via a strong offer and loss framing.
- Capture a cancellation reason on every attempt (currently zero visibility).
- Stay compliant with state auto-renewal laws: the online cancel path must complete without obstruction, so every screen carries a working continue-to-cancel path and the flow ends in a real cancellation if the user persists.

## Current state (grounding)

- Plans (lib/funnel/config.ts): weekly $4.99, annual $29.99 with a 3-day trial.
- Entitlement is driven by the `subscriptions` Postgres table, upserted by Stripe webhooks (lib/stripe/webhook.ts). `cancel_at_period_end: true` keeps status `active`, so access persists until period end with no extra work; the `customer.subscription.deleted` event at period end flips status to `canceled`.
- The webhook reads `subscription.metadata.email`, so subscription metadata is already the established place for per-subscription state. Metadata updates in Stripe merge per key, so adding keys never clobbers `email`.
- No mailer exists in the site. The existing /manage flow trusts a bare email; this project keeps that security posture (see Out of scope).

## 1. Entry and lookup

/manage keeps its email form. `POST /api/portal` is replaced for the cancel path by `POST /api/manage/lookup`, which:

1. Looks up the Stripe customer by normalized email and loads their most recent relevant subscription.
2. Returns: plan, price, status, `cancel_at_period_end`, current period end, trial state, offer-redemption flags (from subscription metadata), and a signed manage token.

The manage token is an HMAC-signed payload of subscription ID, email, and a ~30 minute expiry, following the existing session-signing helper pattern. Every subsequent flow API call requires a valid token; no downstream endpoint trusts a raw email.

After lookup, /manage renders a subscription overview instead of redirecting: plan name, price, next renewal date, and two actions:

- "Update payment method": creates a Stripe billing portal session (portal retained for this only).
- "Cancel subscription" (visually quieter): enters the cancel flow.

Special states on the overview:

- Already set to cancel (`cancel_at_period_end` true): show "Your plan ends on DATE" with a Resume subscription button that unsets the flag. No cancel flow entry needed.
- Past due: show a fix-payment prompt (portal link) plus a plain cancel link that skips the offer step. No discounts for someone who is not paying.

Portal configuration change: cancellation is disabled in the Stripe billing portal configuration so the portal cannot be used as a one-click cancel bypass. This is required for the flow to matter at all.

## 2. The cancel flow (four steps)

Routes live under /manage/cancel as a client-side wizard, reusing the funnel's design language (brand tokens, card layout). State (token, lookup payload, survey answer) is held client-side; a page refresh returns the user to /manage to re-look-up.

Every screen includes a visible "Continue to cancel" link. The flow never dead-ends and never requires contact with support.

### Step 1: reason survey

"Before you go, what's not working?" Single-select, one tap:

- Too expensive
- Not using it enough
- Missing a feature I need
- Something's not working
- I finished what I needed it for

Optional free-text comment. The answer tailors step 2's headline (for example, "too expensive" leads with the offer value framing) and is stored (see Data capture). Selecting an answer advances; "Continue to cancel" also advances without an answer recorded as `skipped`.

### Step 2: loss screen

Headline: "Here's what you'll lose on DATE" (DATE is current period end).

The screen leads with a hero card, visually distinct from the rest of the list (larger, branded accent, badge reading "Only on Video2PDF"):

- **Crisp, clean PDFs generated from your videos**, with supporting copy positioning it as the thing no other app does, for example: "Video2PDF is the only app that turns your videos into crisp, print-ready PDFs." (Marketing claim, owner-approved.)

Below the hero, the remaining Pro benefits as a standard list:

- Full-resolution scans
- Searchable, copyable PDFs
- Unlimited documents

Framing line: "You keep all of this until DATE. After that it's gone."

Primary button: "Keep my benefits" (exits to overview, outcome `abandoned_kept`). Quiet link: "Continue to cancel."

### Step 3: save offer (plan-branched)

Skipped entirely when the plan's offer was already redeemed (metadata flag) or when status is past due.

**Annual ($29.99/yr):** "Stay for $0.99: your entire next year, 97% off."

- Mechanics: apply a one-time $29-off coupon (duration `once`) to the subscription. The next renewal invoice totals $0.99; the following year reverts to $29.99.
- Fine print on the screen states exactly that: "Your next annual renewal on DATE will be $0.99. After that, $29.99/yr unless canceled."
- Trialing annual subscribers get a DEFERRED version of the offer: the first paid year always bills at the full $29.99, and the $0.99 applies to the year after. Accepting during trial records the redemption plus a `winback_deferred` marker on the subscription (no discount yet); the `invoice.paid` webhook attaches the coupon after the first real charge lands, so the next renewal (year 2) invoices at $0.99. Offer copy for trialing users states this explicitly ("Your plan renews at $29.99 on DATE as scheduled. Your renewal after that will be $0.99"). The `offerToTrialing` flag (default true) remains the kill switch for showing trial users any offer at all. The coupon must never discount the trial-conversion invoice.

**Weekly ($4.99/wk):** "Take 30 days on us."

- Mechanics: `pause_collection` with behavior `void` and `resumes_at` 30 days out. No charges for 30 days, access continues (status stays `active`, entitlement unaffected), then $4.99/wk resumes automatically.
- Fine print: "No charges until DATE. Your plan resumes automatically at $4.99/wk."

Layout: accept is the large primary button; "No thanks, cancel my plan" is the quiet link. Accepting short-circuits to a success screen ("You're all set: next year is $0.99" or "Paused until DATE, enjoy") with a link back to the overview.

### Step 4: confirm

"Your plan will end on DATE. You'll keep full access until then." One confirm button sets `cancel_at_period_end: true`. Done screen: "Canceled. You have access until DATE. Changed your mind? Resume anytime at video2pdf.ai/manage."

## 3. API surface

All under /api/manage, all requiring the signed manage token:

- `POST /api/manage/lookup`: email in, overview payload + token out (the only endpoint taking a bare email, matching today's posture).
- `POST /api/manage/resume`: unset `cancel_at_period_end`.
- `POST /api/manage/portal`: portal session for payment methods (replaces the old /api/portal semantics).
- `POST /api/manage/offer`: applies the plan-appropriate offer (coupon or pause), sets the metadata redemption flag in the same update call, records outcome.
- `POST /api/manage/cancel`: sets `cancel_at_period_end: true`, records outcome. Accepts the survey payload (reason, comment, step reached) so feedback lands even if earlier writes failed.
- `POST /api/manage/feedback`: records the survey answer at step 1 time (fire-and-forget from the client).

Offer endpoints re-check the redemption flag server-side before applying; the metadata flag is the source of truth, not the client.

## 4. One-time redemption

- Metadata keys on the Stripe subscription: `winback_redeemed: "1"` (annual coupon) and `pause_redeemed: "1"` (weekly pause), written atomically with the offer-applying update.
- Lookup surfaces the flags; a repeat cancel attempt runs survey, loss screen, then straight to confirm.
- Pause edge: a subscriber currently in a pause who cancels gets a normal `cancel_at_period_end` cancel; access ends at the period end as usual.

## 5. Data capture

New table `cancellation_events`:

| column | type |
|---|---|
| id | serial PK |
| email | text |
| plan | text |
| reason | text nullable (`skipped` when bypassed) |
| comment | text nullable |
| step_reached | text (`survey`, `loss`, `offer`, `confirm`) |
| outcome | text nullable (`saved_offer`, `paused`, `canceled`, `resumed`, `abandoned_kept`) |
| created_at | timestamptz default now() |

Written by the offer, cancel, and feedback endpoints. Abandonment is not stored: it is derived at query time as feedback rows with no terminal-outcome row for the same email within the session window. No client-side beacon on tab close. No dashboard or analytics wiring in this project.

## 6. Compliance guardrails

- Every screen has a visible, working continue-to-cancel path; the flow is at most four taps from entry to canceled.
- The confirm screen states the exact end date and that access continues until then.
- Offer fine print states renewal amounts and dates in plain language.
- Cancellation completes fully online with no support contact, callback, or email round-trip.

## 7. Error handling

- Any Stripe failure mid-flow shows an inline retry, never a dead end.
- If the cancel call itself fails after retries, the client falls back to requesting a portal session created with a one-off portal configuration that has cancellation enabled, so a determined canceler can always complete online. Legal requirement beats retention.
- Lookup for an email with no Stripe customer or no subscription shows the same "no subscription found" message as today.
- Expired manage token on any call returns 401; the client sends the user back to /manage to re-enter their email.

## 8. Testing

Following the site's vitest patterns:

- Unit: manage token mint/verify (tamper, expiry), lookup payload mapping (plan, trial, redeemed flags, cancel-at-period-end, past-due branches), offer branching matrix (plan x trialing x redeemed x past_due), webhook mapping regression (existing tests must stay green, no webhook changes expected).
- Component: wizard step transitions, continue-to-cancel link present on every step, offer screen renders the correct branch per lookup payload, hero card renders on the loss screen.
- API route tests with a mocked Stripe client: offer idempotency (second call is a no-op with the flag set), cancel sets `cancel_at_period_end`, resume unsets it.

## Out of scope

- Email ownership verification (magic link or code): today's /manage already trusts a bare email; this project keeps parity. Worth revisiting if abuse appears.
- App-side cancel surfaces (App Store and Play handle those).
- Churn dashboard over `cancellation_events`.
- Win-back emails (no mailer exists in the site).
- Any change to funnel pricing or plans.
