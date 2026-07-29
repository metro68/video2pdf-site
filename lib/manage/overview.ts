import type { Plan } from "@/lib/db/client";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";
import { MANAGE_CONFIG } from "./config";

// Minimal shape of a Stripe subscription as this module reads it. The pinned
// Stripe apiVersion moved current_period_end onto the subscription items
// (see lib/stripe/webhook.ts for the same handling).
export interface StripeSubLike {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  created: number;
  metadata: Record<string, string>;
  items: { data: Array<{ price: { id: string }; current_period_end?: number }> };
}

export interface ManageOverview {
  plan: Plan;
  priceLabel: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  trialing: boolean;
  pastDue: boolean;
  winbackRedeemed: boolean;
  pauseRedeemed: boolean;
  offerAvailable: boolean;
}

const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

export function pickRelevantSubscription(
  subs: StripeSubLike[],
): StripeSubLike | null {
  const live = subs.filter((s) => LIVE_STATUSES.has(s.status));
  if (live.length === 0) return null;
  return live.sort((a, b) => b.created - a.created)[0];
}

export function mapSubscriptionToOverview(
  sub: StripeSubLike,
  priceToPlan: Record<string, Plan>,
): ManageOverview | null {
  const priceId = sub.items?.data?.[0]?.price?.id;
  const plan = priceId ? priceToPlan[priceId] : undefined;
  if (!plan) return null;

  const trialing = sub.status === "trialing";
  const pastDue = sub.status === "past_due" || sub.status === "unpaid";
  const winbackRedeemed = sub.metadata?.winback_redeemed === "1";
  const pauseRedeemed = sub.metadata?.pause_redeemed === "1";
  const redeemed = plan === "annual" ? winbackRedeemed : pauseRedeemed;
  const offerAvailable =
    !redeemed && !pastDue && (!trialing || MANAGE_CONFIG.offerToTrialing);

  const periodEndSec = sub.items?.data?.[0]?.current_period_end;

  return {
    plan,
    priceLabel: FUNNEL_CONFIG.plans[plan].price,
    status: sub.status,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    currentPeriodEnd: typeof periodEndSec === "number" ? periodEndSec * 1000 : null,
    trialing,
    pastDue,
    winbackRedeemed,
    pauseRedeemed,
    offerAvailable,
  };
}
