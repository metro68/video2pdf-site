# Video2PDF Analytics Dashboard — Design

Date: 2026-07-14
Status: Approved (pending spec review)

## Goal

Convert `video2pdf-site` from a static HTML site to a Next.js app on Vercel, adding a role-aware analytics dashboard that aggregates data from App Store Connect, Google Play, PostHog, AppsFlyer, Meta, and TikTok. Two roles: admin and marketing. The existing static pages (landing, privacy, terms) are preserved.

## Non-goals

- Real-time per-user subscription tracking (no database; revenue/churn come from Apple/Google reporting APIs with a 1-3 day lag).
- Managing users through a UI (the two users are seeded from environment variables).
- Any change to the `video2pdf-app` Express server.

## Architecture

Next.js (App Router), deployed on Vercel, same project/domain (`video2pdf.ai`).

```
video2pdf-site/
├─ app/
│  ├─ page.tsx              landing (port of current index.html)
│  ├─ privacy/page.tsx      port of privacy/index.html
│  ├─ terms/page.tsx        port of terms/index.html
│  ├─ login/page.tsx        email + password form
│  └─ dashboard/
│     ├─ page.tsx           role-aware dashboard
│     └─ components/        KPI tiles, charts, sections
├─ app/api/
│  ├─ auth/login/route.ts   verify credentials, set session cookie
│  ├─ auth/logout/route.ts  clear session
│  └─ metrics/
│     ├─ appstore/route.ts
│     ├─ play/route.ts
│     ├─ posthog/route.ts
│     ├─ appsflyer/route.ts
│     ├─ meta/route.ts
│     └─ tiktok/route.ts
├─ lib/
│  ├─ auth.ts               session sign/verify, role gate
│  ├─ connectors/           one module per provider (fetch + normalize)
│  ├─ cache.ts              in-memory TTL cache + "as of" stamp
│  └─ redact.ts             removes MRR/ARR for the marketing role
├─ middleware.ts            protects /dashboard and /api/metrics/*
└─ docs/superpowers/specs/  this spec
```

Security property: every `/api/metrics/*` route runs server-side only; provider API keys never reach the browser. Each route checks the session role and, for marketing, runs the response through `redact.ts` before responding, so the marketing browser never receives the redacted fields.

## Auth and roles

- Email + password. Two seeded users from env vars:
  - `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (bcrypt)
  - `MARKETING_EMAIL`, `MARKETING_PASSWORD_HASH` (bcrypt)
- On successful login, issue a signed JWT in an httpOnly, secure, sameSite cookie carrying `{ email, role }`. Secret in `JWT_SECRET`.
- `middleware.ts` protects `/dashboard` and `/api/metrics/*`; unauthenticated requests redirect to `/login` (pages) or return 401 (API).

## Role metric split

The redaction is deliberately narrow: only two fields are admin-only.

Admin-only (hidden from marketing):
- MRR (monthly recurring revenue)
- ARR (annual recurring revenue)

Visible to BOTH roles (everything else):
- Acquisition: downloads/installs (total + daily), installs by source/campaign, CPI, CPA
- Engagement: DAU/WAU/MAU, new vs. returning, D1/D7/D30 retention
- Funnel: install → onboarding → paywall view → trial start → subscribe, with counts and conversion rates per step
- Subscribers: trial count, paid subscriber count, trial→paid conversion %, churn rate
- Ad performance: impressions, clicks, CTR, ad spend, ROAS
- Revenue detail: proceeds/revenue by day, refunds, ARPU

`redact.ts` strips exactly `mrr` and `arr` from any metrics payload when the role is marketing. A unit test asserts a marketing payload contains neither field.

## Connectors and data flow

Each connector module exposes `fetch(credentials) -> { data, asOf, status }`:
- `status: "ok"` — data returned.
- `status: "awaiting_credentials"` — required env var missing; the card renders a "Connect <provider>" placeholder.
- `status: "error"` — provider call failed; the card shows an error and last-good cached data if present.

Caching: in-memory TTL cache (~1h) that stamps fetch time. Cold start re-fetches. Acceptable for a low-traffic internal dashboard. The dashboard client always calls its own `/api/metrics/*` routes, never providers directly.

## Dashboard UI

- Visual style matches the existing site: dark theme, teal `#0D9488` accent, same font stack.
- Charts via Recharts, following the dataviz skill for color and accessibility in both light and dark.
- Layout:
  - KPI tile row: downloads, DAU, active paid subs, ARPU, churn %, and (admin only) MRR.
  - Trend charts: downloads over time, DAU over time, revenue/proceeds over time.
  - Acquisition/funnel section: funnel with counts + conversion rates, installs by source, CPI/CPA.
  - Ad performance section: spend, CTR, ROAS by channel (Meta, TikTok).
- Every card shows an "as of <time> · <source>" freshness line. Admin-only tiles are absent entirely for marketing (not rendered), not merely hidden.

## Ships today vs. after credentials

- Today: full Next.js app, auth, both roles, all six connector routes, dashboard UI, all cards. Connectors without keys render "awaiting credentials" gracefully.
- As each key is added to Vercel env and the app is redeployed, that connector goes live. No code change needed per key.

## Secrets and storage

- No database. Users (hashed) and all provider API keys live in Vercel environment variables.
- App Store Connect: `.p8` key contents, key ID, issuer ID.
- Google Play: service-account JSON.
- PostHog: personal/project API key + host.
- AppsFlyer, Meta, TikTok: respective API tokens.

## Testing

- Unit (vitest):
  - `redact.ts` — marketing payload omits `mrr` and `arr`; admin payload retains them.
  - `auth.ts` — role gating, wrong password rejected, expired/invalid token rejected.
  - `cache.ts` — TTL expiry and "as of" stamping.
  - Each connector's `normalize` against a mocked provider response.
- Integration:
  - Marketing session hitting `/api/metrics/appstore` receives a payload with no `mrr`/`arr`.

## Risks and call-outs

- App Store Connect and Google Play credentials are the fiddly ones (generated `.p8` key / service-account JSON). Connectors are built to documented response shapes but can only be verified with real credentials.
- Converting the site from static to Next.js changes the Vercel build output for a domain already serving `video2pdf.ai`; the first deploy needs care.
- Churn is Apple/Google's aggregated definition with a 1-3 day lag; real-time per-user churn would require the deferred database path.
```
