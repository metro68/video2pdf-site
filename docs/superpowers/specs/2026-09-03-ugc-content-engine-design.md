# UGC Content Engine - Design

Date: 2026-09-03  
Status: Approved design, pending written-spec review

## Goal

Add a supervised content-production tab to the existing Video2PDF dashboard. One
Video2PDF workspace will research ideas, generate faceless Instagram and TikTok
content, distribute approved variants across many connected social accounts, and
compare post performance with Video2PDF web and app conversions.

## Product workflow

The new `/dashboard/content` tab has six views:

1. **Trends** - maintain a watchlist of owned and public competitor accounts, rank
   their posts by momentum and outlier performance, and accept saved Instagram or
   TikTok URLs and uploaded examples. AI extracts the hook, angle, structure,
   visual pattern, and reusable elements.
2. **Campaigns** - define the objective, audience, CTA, destination, social
   accounts, and a test matrix of hooks, angles, and formats.
3. **Avatars** - upload one or more reference photos for reusable avatar profiles.
   Generate still scenes such as mirror selfies, phone-over-face photos, desk
   scenes, product holds, and casual lifestyle shots.
4. **Review** - generate, preview, edit, reject, regenerate, or batch-approve Reels
   and carousels. Nothing publishes without approval.
5. **Calendar** - assign approved variants to connected accounts and schedule them.
6. **Results** - rank posts by reach, engagement, and available conversion data,
   then recommend the next variants to test.

## Generation

- Anthropic analyses examples and produces concepts, scripts, captions, prompts,
  and performance summaries.
- OpenAI generates and edits avatar/reference-based images and produces optional
  voice-over audio.
- A template renderer applies text after image generation, ensuring readable,
  correctly spelled overlays.
- Remotion/FFmpeg assembles stills, motion, transitions, captions, and audio into
  vertical Reels. Sharp produces carousel slides.
- Automated checks flag identity drift, malformed hands or phones, unreadable text,
  unsupported marketing claims, and incorrect aspect ratios before review.

Talking-head and lip-synced avatar generation are outside v1.

## Social accounts and publishing

- The existing dashboard remains one Video2PDF workspace with its current roles.
  There is no customer signup, billing, or multi-tenant workspace model.
- Any number of Instagram Professional and TikTok accounts can be connected by
  OAuth. Access and refresh tokens stay encrypted on the server.
- Platform-specific adapters handle publishing and analytics independently.
- Approved items become idempotent scheduled jobs. Temporary failures retry with
  backoff; expired permissions stop the job and show `Reconnect account`; a
  successful platform post ID prevents duplicate publication.
- Instagram and TikTok publishing depend on the relevant platform permissions and
  app review. Before approval, the same workflow can export a complete post package
  for manual publishing.

## Analytics and trend discovery

The system distinguishes two account types:

- **Owned accounts:** Instagram Professional and TikTok accounts connected by OAuth.
  These support publishing and the deepest metrics the platform makes available.
  Instagram can provide views/reach, likes, comments, shares, saves, available
  watch-time metrics, follows, and profile activity. TikTok's standard authorized
  video data includes views, likes, comments, and shares.
- **Watched public accounts:** any public Instagram or TikTok handle added without
  ownership. A public-data collector records visible profile and post fields such as
  follower count, post URL, published time, caption, views when public, likes, and
  comments. It cannot retrieve private insights such as viewer identities,
  retention, saves, reach, or profile visits when those are not publicly shown.

The public-data collector sits behind an adapter because collection may be provided
by a licensed data source or by a compliant first-party collector. The product does
not pretend these public metrics came from the owned-account Insights APIs. Each
field carries source, freshness, and availability metadata.

From public snapshots the system calculates engagement rate, view-to-follower ratio,
posting velocity, median account baseline, and an outlier score. The Trends view
ranks recent posts across the watchlist, creating the equivalent of a curated
trending feed for Video2PDF's niches. Operators can add a handle or request that an
account be added, and the collector refreshes it on a schedule.

Saved URLs, uploaded examples, Meta Ad Library, and approved TikTok commercial-
content data remain additional research inputs.

## Conversion attribution

Each campaign and publication has an internal ID. Generated links use the existing
`/go` funnel and its `src`, `utm_campaign`, and `utm_content` fields.

- A unique post link or code permits exact post-level attribution.
- A shared bio link permits account/campaign attribution only.
- The dashboard never labels timing-based correlation as an exact conversion.

Results join social metrics with the existing leads table, Stripe web trials and
payments, AppsFlyer app installs and trials, and PostHog product events. The output
shows web and app outcomes without replacing the existing Overview or Ads eval tabs.

## Architecture

- **Control plane:** the existing Next.js application on Vercel.
- **Database:** extend the existing Postgres database with social accounts, avatars,
  trends, campaigns, variants, generation jobs, publications, and metric snapshots.
- **Media:** object storage for reference images, generated assets, rendered files,
  and post-package exports.
- **Worker:** a separate Node worker handles long-running AI, rendering, publishing,
  and analytics-sync jobs that are unsuitable for request-time Vercel functions.
- **Provider boundaries:** Anthropic, OpenAI, Instagram, TikTok, and the public-data
  collector each sit behind a small adapter so model, API, or collection-source
  changes do not rewrite campaign logic.

## Failure handling and verification

- Every asset and publication exposes its current stage, attempt count, error, and
  retry action. Partial batch failures do not discard successful items.
- Generation and publishing use idempotency keys and server-side rate limiting.
- Verification uses provider sandboxes or private test posts, renderer spot checks,
  typecheck, lint, and manual end-to-end checks. No live social post is published
  during development without fresh explicit approval.
- No new test files are added unless explicitly requested, following the repository
  working agreement.

## V1 exclusions

- Talking-head avatars
- Creator marketplace, contracts, shipping, or payments
- Paid-ad buying or campaign mutation
- Comment and inbox management
- Customer workspaces or public self-service signup
- Unreviewed autonomous publishing
- Guaranteed exact post attribution when the platform offers no post-specific link
- Collection of private competitor metrics or viewer identities
