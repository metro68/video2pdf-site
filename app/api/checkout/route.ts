import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";

type Plan = "weekly" | "annual";

export async function POST(request: Request): Promise<NextResponse> {
  const { plan, email } = await request.json().catch(() => ({}));
  if (plan !== "weekly" && plan !== "annual") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  const priceEnv: Record<Plan, string | undefined> = {
    weekly: process.env.STRIPE_PRICE_WEEKLY,
    annual: process.env.STRIPE_PRICE_ANNUAL,
  };
  const price = priceEnv[plan as Plan];
  if (!price) {
    return NextResponse.json({ error: "Price not configured" }, { status: 500 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://video2pdf.ai";
  const trialDays = FUNNEL_CONFIG.plans[plan as Plan].trialDays;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price, quantity: 1 }],
    subscription_data: {
      metadata: { email },
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
    },
    success_url: `${site}/go/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/go?canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}
