import { stripe, PRICE_TO_PLAN } from "@/lib/stripe/client";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";
import { Handoff } from "./components/Handoff";

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id: sessionId } = await searchParams;

  let token = "";
  let value = 0;
  let eventId = "";

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

    token =
      (session.metadata?.redeem_token as string | undefined) ??
      (subscription?.metadata?.redeem_token as string | undefined) ??
      "";
  }

  return <Handoff token={token} value={value} eventId={eventId} />;
}
