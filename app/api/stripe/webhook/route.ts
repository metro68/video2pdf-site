import { NextResponse } from "next/server";
import { stripe, PRICE_TO_PLAN } from "@/lib/stripe/client";
import { mapEventToMutation } from "@/lib/stripe/webhook";
import { upsertSubscription, mintRedeemToken } from "@/lib/db/subscriptions";
import { generateRedeemCode } from "@/lib/db/redeemCode";
import { sendCapiPurchase, sendCapiStartTrial } from "@/lib/pixel/capi";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";

const DEFAULT_REDEEM_TTL_MS = 7 * 86400_000;

export async function POST(request: Request): Promise<NextResponse> {
  const sig = request.headers.get("stripe-signature") ?? "";
  const raw = await request.text();

  // Read env inside the handler so test-time env stubs are honored (module-level
  // reads are captured at import time, before vi.stubEnv can apply).
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const redeemTtlMs = Number(process.env.REDEEM_TOKEN_TTL_MS ?? DEFAULT_REDEEM_TTL_MS);

  // Stripe's Event type varies by event; we narrow via mapEventToMutation and manual checks below.
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const mutation = mapEventToMutation(event, PRICE_TO_PLAN);
  if (mutation.kind === "upsert") {
    await upsertSubscription(mutation.input);
  }

  if (event.type === "checkout.session.completed") {
    // Dynamic Stripe Checkout Session payload; only the fields we need are read here.
    const o: any = event.data.object;
    const rawEmail = o?.metadata?.email ?? o?.customer_details?.email;
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : rawEmail;
    const sessionId = o?.id;
    if (email && sessionId) {
      // Idempotency guard: a retried delivery of this event should not mint a
      // second redeem token or resend CAPI Purchase. If the subscription already
      // carries a redeem_token in its metadata, this session has already been
      // processed, so skip minting and CAPI on replay.
      let alreadyProcessed = false;
      // Dynamic Stripe Subscription payload; only the fields we need are read here.
      let subscription: any = null;
      if (o.subscription) {
        subscription = await stripe.subscriptions.retrieve(o.subscription);
        alreadyProcessed = Boolean(subscription.metadata?.redeem_token);
      }

      if (!alreadyProcessed) {
        const subItem = subscription?.items?.data?.[0];
        const subPriceId = subItem?.price?.id;
        const plan = subPriceId ? PRICE_TO_PLAN[subPriceId] : undefined;

        // redeem_tokens.email has an FK to subscriptions(email). checkout.session.completed
        // can arrive before the customer.subscription.* event, so we upsert the row here.
        // Populate the real period/trial dates from the subscription we already retrieved
        // (current_period_end lives on the subscription item in the pinned apiVersion,
        // trial_end on the root), so a redeem right after checkout has a numeric expiry
        // instead of waiting on the separate customer.subscription.* event.
        const secToMs = (v: unknown): number | null =>
          typeof v === "number" ? v * 1000 : null;
        await upsertSubscription({
          email,
          stripeCustomerId: o.customer ?? null,
          stripeSubscriptionId: o.subscription ?? null,
          plan: plan ?? "weekly",
          status: (subscription?.status as string) === "active" ? "active" : "trialing",
          currentPeriodEnd: secToMs(subItem?.current_period_end),
          trialEnd: secToMs(subscription?.trial_end),
        });

        const token = generateRedeemCode();
        await mintRedeemToken(email, redeemTtlMs, token);
        if (o.subscription) {
          await stripe.subscriptions.update(o.subscription, {
            metadata: { redeem_token: token, email },
          });
        }

        // Purchase value must be the plan's catalog value, not amount_total: the trial
        // is on the annual plan, so amount_total is 0 at checkout.session.completed for
        // annual and would otherwise report a $0 Purchase. Fall back to amount_total
        // only if the plan cannot be determined.
        const value = plan
          ? FUNNEL_CONFIG.plans[plan].cents / 100
          : (o.amount_total ?? 0) / 100;

        const currency = String(o.currency ?? "usd").toUpperCase();

        // _fbp/_fbc were stashed in session metadata by /api/checkout so these
        // server-side events can match the originating click and browser.
        const fbp = typeof o?.metadata?.fbp === "string" ? o.metadata.fbp : undefined;
        const fbc = typeof o?.metadata?.fbc === "string" ? o.metadata.fbc : undefined;

        await sendCapiPurchase({ email, value, currency, eventId: sessionId, fbp, fbc });

        // StartTrial mirrors the app's Facebook StartTrial signal for the trial plan
        // only (annual). Reuses the Purchase session-id eventId so the browser
        // StartTrial (fired on the success page) and this CAPI event dedup in Meta.
        if (plan === "annual") {
          await sendCapiStartTrial({ email, value, currency, eventId: sessionId, fbp, fbc });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
