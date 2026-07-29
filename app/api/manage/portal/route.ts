import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { loadManagedSubscription } from "@/lib/manage/auth";
import { ensurePortalConfiguration } from "@/lib/manage/stripeOps";

export async function POST(request: Request): Promise<NextResponse> {
  const { token, fallbackCancel } = await request.json().catch(() => ({}));
  const managed = await loadManagedSubscription(token);
  if (!managed) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.video2pdf.ai";
  try {
    const configuration = await ensurePortalConfiguration(fallbackCancel === true);
    const customer = managed.sub.customer;
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      configuration,
      return_url: `${site}/manage`,
    });
    return NextResponse.json({ url: portal.url });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
