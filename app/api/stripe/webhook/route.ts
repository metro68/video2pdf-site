import { NextResponse } from "next/server";
import { stripe, PRICE_TO_PLAN } from "@/lib/stripe/client";
import { mapEventToMutation } from "@/lib/stripe/webhook";
import { upsertSubscription, mintRedeemToken } from "@/lib/db/subscriptions";
import { sendCapiPurchase } from "@/lib/pixel/capi";
import { randomUUID } from "node:crypto";

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
    const email = o?.metadata?.email ?? o?.customer_details?.email;
    const sessionId = o?.id;
    if (email && sessionId) {
      // Idempotency guard: a retried delivery of this event should not mint a
      // second redeem token or resend CAPI Purchase. If the subscription already
      // carries a redeem_token in its metadata, this session has already been
      // processed, so skip minting and CAPI on replay.
      let alreadyProcessed = false;
      if (o.subscription) {
        const subscription = await stripe.subscriptions.retrieve(o.subscription);
        alreadyProcessed = Boolean(subscription.metadata?.redeem_token);
      }

      if (!alreadyProcessed) {
        const token = randomUUID();
        await mintRedeemToken(email, redeemTtlMs, token);
        if (o.subscription) {
          await stripe.subscriptions.update(o.subscription, {
            metadata: { redeem_token: token, email },
          });
        }
        await sendCapiPurchase({
          email,
          value: (o.amount_total ?? 0) / 100,
          currency: String(o.currency ?? "usd").toUpperCase(),
          eventId: sessionId,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
