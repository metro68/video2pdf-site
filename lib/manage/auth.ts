import { stripe, PRICE_TO_PLAN } from "@/lib/stripe/client";
import { verifyManageToken } from "./token";
import {
  mapSubscriptionToOverview,
  type ManageOverview,
  type StripeSubLike,
} from "./overview";

export interface ManagedSubscription {
  email: string;
  sub: StripeSubLike;
  overview: ManageOverview;
}

// Verifies the manage token and re-fetches the subscription so every action
// route decides on fresh Stripe state, never on client-supplied claims.
export async function loadManagedSubscription(
  token: unknown,
): Promise<ManagedSubscription | null> {
  if (typeof token !== "string") return null;
  const payload = await verifyManageToken(token);
  if (!payload) return null;
  try {
    const raw = await stripe.subscriptions.retrieve(payload.subscriptionId);
    // Narrow Stripe's wide Subscription type to the fields we read.
    const sub = raw as unknown as StripeSubLike;
    const overview = mapSubscriptionToOverview(sub, PRICE_TO_PLAN);
    if (!overview) return null;
    return { email: payload.email, sub, overview };
  } catch {
    return null;
  }
}
