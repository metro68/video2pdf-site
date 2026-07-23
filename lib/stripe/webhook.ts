import type { Plan, SubStatus } from "@/lib/db/client";
import type { UpsertSubscriptionInput } from "@/lib/db/subscriptions";

export interface StripeEventLike {
  type: string;
  // Stripe event payloads are dynamically shaped per event type; kept untyped on purpose.
  data: { object: any };
}

export type SubscriptionMutation =
  | { kind: "upsert"; input: UpsertSubscriptionInput }
  | { kind: "none" };

export function stripeStatusToLocal(s: string): SubStatus {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "canceled":
      return "canceled";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    default:
      return "past_due";
  }
}

const secToMs = (v: unknown): number | null =>
  typeof v === "number" ? v * 1000 : null;

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export function mapEventToMutation(
  event: StripeEventLike,
  priceToPlan: Record<string, Plan>,
): SubscriptionMutation {
  if (!SUBSCRIPTION_EVENTS.has(event.type)) return { kind: "none" };
  // Dynamic Stripe event payload; shape varies by event type and is not fully typed here.
  const o = event.data.object;
  const rawEmail = o?.metadata?.email;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : rawEmail;
  const priceId = o?.items?.data?.[0]?.price?.id;
  const plan = priceId ? priceToPlan[priceId] : undefined;
  if (!email || !plan) return { kind: "none" };
  const status =
    event.type === "customer.subscription.deleted"
      ? "canceled"
      : stripeStatusToLocal(String(o.status));
  return {
    kind: "upsert",
    input: {
      email,
      stripeCustomerId: o.customer ?? null,
      stripeSubscriptionId: o.id ?? null,
      plan,
      status,
      // The pinned Stripe apiVersion moved current_period_end off the Subscription
      // root onto the subscription items; trial_end is still on the root.
      currentPeriodEnd: secToMs(o?.items?.data?.[0]?.current_period_end),
      trialEnd: secToMs(o.trial_end),
    },
  };
}
