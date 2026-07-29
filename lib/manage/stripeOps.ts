import { stripe } from "@/lib/stripe/client";
import { MANAGE_CONFIG } from "./config";

// All operations are idempotent from the caller's perspective: coupons and portal
// configurations are ensure-style (create only when missing), and subscription
// updates set absolute state. Metadata updates merge per key in Stripe, so the
// webhook's metadata.email is never clobbered.

export async function ensureWinbackCoupon(): Promise<string> {
  try {
    const existing = await stripe.coupons.retrieve(MANAGE_CONFIG.winbackCouponId);
    return existing.id;
  } catch (err) {
    // Stripe errors carry code "resource_missing" for unknown ids; anything else
    // (auth, network) should propagate.
    if ((err as { code?: string })?.code !== "resource_missing") throw err;
  }
  const created = await stripe.coupons.create({
    id: MANAGE_CONFIG.winbackCouponId,
    amount_off: MANAGE_CONFIG.winbackAmountOffCents,
    currency: "usd",
    duration: "once",
    name: "Winback: next year $0.99",
  });
  return created.id;
}

export async function applyAnnualWinback(subscriptionId: string): Promise<void> {
  const coupon = await ensureWinbackCoupon();
  await stripe.subscriptions.update(subscriptionId, {
    discounts: [{ coupon }],
    metadata: { winback_redeemed: "1" },
  });
}

export async function applyWeeklyPause(
  subscriptionId: string,
  resumesAtSec: number,
): Promise<void> {
  await stripe.subscriptions.update(subscriptionId, {
    pause_collection: { behavior: "void", resumes_at: resumesAtSec },
    metadata: { pause_redeemed: "1" },
  });
}

export async function setCancelAtPeriodEnd(
  subscriptionId: string,
  value: boolean,
): Promise<void> {
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: value,
  });
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.video2pdf.ai";

export async function ensurePortalConfiguration(
  allowCancel: boolean,
): Promise<string> {
  const key = allowCancel ? "manage-cancel-fallback" : "manage-default";
  const existing = await stripe.billingPortal.configurations.list({ limit: 100 });
  const match = existing.data.find((c) => c.metadata?.v2p === key);
  if (match) return match.id;

  const created = await stripe.billingPortal.configurations.create({
    metadata: { v2p: key },
    business_profile: {
      headline: "Video2PDF",
      privacy_policy_url: `${SITE}/privacy`,
      terms_of_service_url: `${SITE}/terms`,
    },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      subscription_cancel: allowCancel
        ? { enabled: true, mode: "at_period_end" }
        : { enabled: false },
    },
  });
  return created.id;
}
