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
