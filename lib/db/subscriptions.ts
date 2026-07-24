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
