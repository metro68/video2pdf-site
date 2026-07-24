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

// Returns a usable redeem token for this email, minting one if none exists yet.
// The success page calls this so a code is ALWAYS shown, even when the Stripe
// webhook has not finished processing at redirect time (a timing race that would
// otherwise leave the code blank). Reuses an existing unconsumed, unexpired token
// so a page refresh does not pile up tokens. Requires the subscriptions row to
// exist (FK); the caller ensures that via upsertSubscription first.
export async function getOrCreateRedeemTokenForEmail(
  email: string,
  ttlMs: number,
  newToken: string,
): Promise<string> {
  const existing = await sql`
    SELECT token FROM redeem_tokens
    WHERE email = ${email} AND consumed_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (existing.rows[0]?.token) {
    return existing.rows[0].token as string;
  }
  return mintRedeemToken(email, ttlMs, newToken);
}
