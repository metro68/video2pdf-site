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

-- Deny-all Row Level Security. Our site and server connect with the full Postgres
-- service credentials (POSTGRES_URL / DATABASE_URL), which bypass RLS, so backend
-- access is unaffected. Enabling RLS with no policies blocks Supabase anon and
-- authenticated keys from ever reading these tables (emails, subscription status,
-- redeem tokens) via the auto-generated REST/GraphQL API.
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE redeem_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS leads (
  email TEXT PRIMARY KEY,
  scan_type TEXT,
  frequency TEXT,
  src TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminder_sent_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Durable connector cache: survives serverless cold starts and deploys, so
-- rate-limited APIs (AppsFlyer aggregate reports) are called a handful of
-- times per day instead of once per instance. Values are whole connector
-- payloads; staleness policy lives in the reading code.
CREATE TABLE IF NOT EXISTS metric_cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  as_of TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE metric_cache ENABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- UGC Content Engine
-- Spec: docs/superpowers/specs/2026-09-03-ugc-content-engine-design.md
--
-- One Video2PDF workspace manages many owned social accounts and watches
-- public ones for research. Every table below is deny-all RLS like the rest
-- of this schema: the site and worker connect with full Postgres credentials
-- which bypass RLS, so Supabase anon/authenticated keys can never read any of
-- it through the auto-generated REST API.
-- ==========================================================================

-- Owned accounts connect by OAuth and support publishing plus deep insights.
-- Watched accounts are public handles we do not own: research only, never a
-- publish target. The distinction is enforced by `kind` rather than by two
-- tables so the watchlist and the account picker read from one place.
CREATE TABLE IF NOT EXISTS social_accounts (
  id BIGSERIAL PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('instagram','tiktok')),
  kind TEXT NOT NULL CHECK (kind IN ('owned','watched')),
  handle TEXT NOT NULL,
  display_name TEXT,
  -- Platform's own id for the account. Null for watched accounts we only know
  -- by handle, and for owned accounts until the first successful OAuth.
  platform_account_id TEXT,
  -- The niche/angle this owned account is differentiated on. Two accounts
  -- posting the same angle is what gets a cluster flagged, so this is a
  -- first-class field, not a note.
  angle TEXT,
  -- OAuth material, encrypted at rest by lib/content/crypto.ts. Never selected
  -- into any dashboard payload.
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  -- Set when the platform rejects our credentials, so the UI can show
  -- "Reconnect account" instead of silently failing every scheduled job.
  needs_reconnect BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, handle)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_kind ON social_accounts(kind, platform);

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

-- Point-in-time profile readings for a watched or owned account. Kept as
-- snapshots rather than mutable columns so posting velocity and follower
-- growth are derivable, and so a stale reading is visibly stale rather than
-- silently overwriting a fresh one.
CREATE TABLE IF NOT EXISTS account_snapshots (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  followers INTEGER,
  following INTEGER,
  post_count INTEGER,
  -- Which adapter produced this row: 'manual' for operator entry, later
  -- 'business_discovery' or a licensed provider. Carried through to the UI so
  -- no figure is ever shown without its provenance.
  source TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_snapshots_account
  ON account_snapshots(account_id, collected_at DESC);

ALTER TABLE account_snapshots ENABLE ROW LEVEL SECURITY;

-- Public post metrics for the research watchlist. Only fields a platform
-- actually exposes publicly are stored; private insights (reach, saves,
-- retention, viewer identity) are deliberately absent for watched accounts
-- and stay NULL rather than being estimated. `views` is null on Instagram
-- where the count is not public.
CREATE TABLE IF NOT EXISTS post_snapshots (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  -- Platform's post id where known, else the canonical URL. Together with
  -- collected_at this is what makes repeat collection idempotent.
  platform_post_id TEXT NOT NULL,
  post_url TEXT,
  caption TEXT,
  media_type TEXT CHECK (media_type IN ('reel','video','image','carousel','unknown')),
  published_at TIMESTAMPTZ,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  source TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, platform_post_id, collected_at)
);

CREATE INDEX IF NOT EXISTS idx_post_snapshots_account
  ON post_snapshots(account_id, published_at DESC);

ALTER TABLE post_snapshots ENABLE ROW LEVEL SECURITY;

-- A campaign is an objective plus the accounts and test matrix that serve it.
-- Cost controls live here rather than in global config because image spend is
-- ~85% of the engine's running cost and a bad prompt loop is the realistic
-- failure mode: the worker refuses to start a job that would breach the cap.
CREATE TABLE IF NOT EXISTS campaigns (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT,
  audience TEXT,
  cta TEXT,
  -- Landing destination. Defaults to the existing /go funnel, and the tracking
  -- link built from it carries utm_content = the publication id, which is what
  -- makes exact post-level attribution possible at all.
  destination_path TEXT NOT NULL DEFAULT '/go',
  utm_campaign TEXT,
  -- Image quality tier for generation. Defaults to the cheapest that still
  -- reads well, since our renderer applies text overlays after generation and
  -- so does not depend on the model rendering legible type.
  image_quality TEXT NOT NULL DEFAULT 'low'
    CHECK (image_quality IN ('low','medium','high')),
  -- Hard ceiling on generation spend for this campaign, in cents. Null means
  -- no cap. Enforced by the worker before each job, not after.
  image_budget_cents INTEGER,
  spent_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- A concept is the reusable, cheap half of a creative: the hook, angle and
-- structure that tested well. Concepts are reused across accounts; the media
-- built from them is NOT. Instagram fingerprints frames and text overlays and
-- TikTok perceptual-hashes the video and audio separately, so sharing rendered
-- assets across accounts gets the whole cluster suppressed. Reusing a concept
-- costs a few tenths of a cent in prompt tokens; reusing a file costs reach.
CREATE TABLE IF NOT EXISTS concepts (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT REFERENCES campaigns(id) ON DELETE CASCADE,
  hook TEXT NOT NULL,
  angle TEXT,
  structure TEXT,
  format TEXT NOT NULL DEFAULT 'reel'
    CHECK (format IN ('reel','carousel','image')),
  -- Where this concept came from: an operator idea, or a post_snapshots row
  -- the Trends view surfaced as an outlier.
  source_post_id BIGINT REFERENCES post_snapshots(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concepts_campaign ON concepts(campaign_id);

ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;

-- A variant is one concept realised for one account: its own script, its own
-- generated stills, its own audio, its own render. Two variants of the same
-- concept share no media bytes by design (see the concepts comment above).
CREATE TABLE IF NOT EXISTS variants (
  id BIGSERIAL PRIMARY KEY,
  concept_id BIGINT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  account_id BIGINT REFERENCES social_accounts(id) ON DELETE SET NULL,
  script TEXT,
  caption TEXT,
  hashtags TEXT,
  -- Storage keys for the rendered output and its slides/stills. Objects live
  -- in the media bucket; only keys are stored here.
  render_key TEXT,
  asset_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Review state. Nothing reaches a publication without passing 'approved'.
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','generating','needs_review','approved','rejected','failed')),
  reject_reason TEXT,
  -- Automated pre-review checks (identity drift, malformed hands, unreadable
  -- text, wrong aspect ratio). Shape: [{ check, passed, detail }].
  quality_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_variants_concept ON variants(concept_id);
CREATE INDEX IF NOT EXISTS idx_variants_status ON variants(status);

ALTER TABLE variants ENABLE ROW LEVEL SECURITY;

-- Reusable avatar profiles built from operator-uploaded reference photos.
-- v1 generates still scenes only: no talking-head, no lip sync.
CREATE TABLE IF NOT EXISTS avatars (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  reference_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;

-- Work queue for everything too slow for a request-time Vercel function:
-- generation, rendering, publishing, analytics sync. The worker claims rows
-- with SELECT ... FOR UPDATE SKIP LOCKED, so several workers can run without
-- coordinating and a crashed worker's row becomes claimable again once its
-- lease expires. Postgres rather than a queue vendor: the volume is small,
-- job state is exactly what the dashboard needs to display anyway, and it
-- adds no new secrets or webhook surface.
CREATE TABLE IF NOT EXISTS generation_jobs (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN (
    'concept','script','images','render','publish','sync_metrics','collect_public'
  )),
  -- Subject of the job. Which one is set depends on kind.
  variant_id BIGINT REFERENCES variants(id) ON DELETE CASCADE,
  campaign_id BIGINT REFERENCES campaigns(id) ON DELETE CASCADE,
  account_id BIGINT REFERENCES social_accounts(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','canceled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  -- Caller-supplied key making enqueue idempotent: retrying a request that
  -- already created a job returns the existing one instead of a duplicate.
  idempotency_key TEXT UNIQUE,
  -- Worker lease. claimed_at + lease means an abandoned job is retryable.
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  cost_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The claim query's index: queued jobs whose run_after has passed, oldest first.
CREATE INDEX IF NOT EXISTS idx_generation_jobs_claim
  ON generation_jobs(status, run_after) WHERE status = 'queued';

ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

-- An approved variant scheduled to, or posted on, one account. A non-null
-- platform_post_id is the duplicate-publication guard: once the platform has
-- given us an id, no retry may post again.
CREATE TABLE IF NOT EXISTS publications (
  id BIGSERIAL PRIMARY KEY,
  variant_id BIGINT NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  platform_post_id TEXT,
  post_url TEXT,
  -- utm_content value used in this publication's tracking link. Present only
  -- when the destination supports a unique link, and it is the sole basis on
  -- which the Results view may claim exact post-level attribution.
  tracking_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','publishing','published','failed','canceled','exported')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (variant_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_publications_schedule
  ON publications(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_publications_account ON publications(account_id);

ALTER TABLE publications ENABLE ROW LEVEL SECURITY;

-- Metrics for our own published posts, from the owned-account APIs. Snapshots
-- rather than mutable counters so growth curves are derivable. Fields the
-- platform does not return stay NULL: TikTok's standard authorized video data
-- has no reach or saves, and absent is not zero.
CREATE TABLE IF NOT EXISTS publication_metrics (
  id BIGSERIAL PRIMARY KEY,
  publication_id BIGINT NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  views INTEGER,
  reach INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER,
  follows INTEGER,
  profile_visits INTEGER,
  watch_time_seconds INTEGER,
  source TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publication_metrics_pub
  ON publication_metrics(publication_id, collected_at DESC);

ALTER TABLE publication_metrics ENABLE ROW LEVEL SECURITY;
