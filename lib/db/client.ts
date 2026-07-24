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
