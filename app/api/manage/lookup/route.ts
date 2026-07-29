import { NextResponse } from "next/server";
import { stripe, PRICE_TO_PLAN } from "@/lib/stripe/client";
import { signManageToken } from "@/lib/manage/token";
import {
  mapSubscriptionToOverview,
  pickRelevantSubscription,
  type StripeSubLike,
} from "@/lib/manage/overview";

export async function POST(request: Request): Promise<NextResponse> {
  const { email } = await request.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();

  try {
    const customers = await stripe.customers.list({ email: normalized, limit: 1 });
    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: "No subscription found for that email" },
        { status: 404 },
      );
    }

    const subs = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: "all",
      limit: 10,
    });
    // Stripe's typed Subscription is wider than the minimal shape we read; the
    // pinned apiVersion keeps current_period_end on the items (see webhook.ts).
    const picked = pickRelevantSubscription(subs.data as unknown as StripeSubLike[]);
    const overview = picked ? mapSubscriptionToOverview(picked, PRICE_TO_PLAN) : null;
    if (!picked || !overview) {
      return NextResponse.json(
        { error: "No subscription found for that email" },
        { status: 404 },
      );
    }

    const token = await signManageToken({ subscriptionId: picked.id, email: normalized });
    return NextResponse.json({ token, overview });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
