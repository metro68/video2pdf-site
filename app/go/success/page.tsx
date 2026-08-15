import { stripe, PRICE_TO_PLAN } from "@/lib/stripe/client";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";
import { upsertSubscription, getOrCreateRedeemTokenForEmail } from "@/lib/db/subscriptions";
import { generateRedeemCode } from "@/lib/db/redeemCode";
import { Handoff } from "./components/Handoff";

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id: sessionId } = await searchParams;

  let token = "";
  let value = 0;
  let eventId = "";
  let isTrial = false;
  let utmCampaign = "";
  let utmContent = "";

  if (sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    eventId = session.id;

    const subscription =
      typeof session.subscription === "object" && session.subscription !== null
        ? session.subscription
        : null;

    // Purchase value must be the plan's catalog value, not amount_total: the trial is
    // on the annual plan, so amount_total is 0 at checkout for annual. This must match
    // the value the webhook/CAPI Purchase sends for the same session, since browser and
    // CAPI Purchase share the same eventId and now must share the same value.
    // Dynamic Stripe Subscription payload; only the fields we need are read here.
    const subPriceId = (subscription as any)?.items?.data?.[0]?.price?.id as
      | string
      | undefined;
    const plan = subPriceId ? PRICE_TO_PLAN[subPriceId] : undefined;
    value = plan ? FUNNEL_CONFIG.plans[plan].cents / 100 : (session.amount_total ?? 0) / 100;
    isTrial = plan ? FUNNEL_CONFIG.plans[plan].trialDays > 0 : false;

    // Originating ad identifiers, captured by the funnel and stored on the
    // checkout session; forwarded through the store handoff so AppsFlyer can
    // credit the install to the ad that started the chain, not just the link.
    utmCampaign = session.metadata?.utm_campaign ?? "";
    utmContent = session.metadata?.utm_content ?? "";

    const metadataToken =
      (session.metadata?.redeem_token as string | undefined) ??
      (subscription?.metadata?.redeem_token as string | undefined) ??
      "";

    const email = (session.customer_details?.email ?? session.metadata?.email ?? "")
      .toLowerCase()
      .trim();

    if (email) {
      // The webhook writes the redeem token to Stripe metadata asynchronously, so it
      // often has not run yet when the browser lands here right after checkout, which
      // would otherwise leave the code blank. Get-or-create the token directly instead
      // of only reading metadata, so a code is always shown. upsertSubscription must run
      // first: getOrCreateRedeemTokenForEmail inserts against a foreign key on the
      // subscriptions row, and getOrCreateRedeemTokenForEmail reuses any unconsumed,
      // unexpired token (including one the webhook already minted), so this agrees with
      // the webhook and a page refresh never mints duplicates.
      try {
        const customerId =
          typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
        const subscriptionId = subscription?.id ?? null;
        await upsertSubscription({
          email,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          plan: plan ?? "annual",
          status: "trialing",
          currentPeriodEnd: null,
          trialEnd: null,
        });
        token = await getOrCreateRedeemTokenForEmail(
          email,
          Number(process.env.REDEEM_TOKEN_TTL_MS ?? 604800000),
          generateRedeemCode(),
        );
      } catch {
        token = metadataToken;
      }
    } else {
      token = metadataToken;
    }
  }

  return (
    <Handoff
      token={token}
      value={value}
      eventId={eventId}
      isTrial={isTrial}
      utmCampaign={utmCampaign}
      utmContent={utmContent}
    />
  );
}
