import { stripe } from "@/lib/stripe/client";
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
    value = (session.amount_total ?? 0) / 100;
    eventId = session.id;

    const subscription =
      typeof session.subscription === "object" && session.subscription !== null
        ? session.subscription
        : null;

    token =
      (session.metadata?.redeem_token as string | undefined) ??
      (subscription?.metadata?.redeem_token as string | undefined) ??
      "";
  }

  return <Handoff token={token} value={value} eventId={eventId} />;
}
