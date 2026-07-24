import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";

export async function POST(request: Request): Promise<NextResponse> {
  const { email } = await request.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.video2pdf.ai";

  try {
    const customers = await stripe.customers.list({
      email: email.trim().toLowerCase(),
      limit: 1,
    });
    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: "No subscription found for that email" },
        { status: 404 },
      );
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${site}/manage`,
    });

    return NextResponse.json({ url: portal.url });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
