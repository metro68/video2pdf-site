import { stripe } from "@/lib/stripe/client";

// Policy: one failed subscription charge ends the subscription immediately.
// We do not use Stripe's retry/dunning cycle. Voiding the open invoice stops
// any further collection attempts; canceling the subscription emits
// customer.subscription.deleted, which the webhook maps to status "canceled",
// killing the app entitlement.
//
// Void runs before cancel so that a partial failure (void succeeded, cancel
// threw, Stripe redelivers the event) can never re-charge the card in the gap.
// Both steps are guarded by status checks, so redelivered events are no-ops.
export async function cancelSubscriptionOnPaymentFailure(
  subscriptionId: string,
  invoiceId: string | null,
): Promise<void> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (subscription.status === "canceled") return;

  if (invoiceId) {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.status === "open") {
      await stripe.invoices.voidInvoice(invoiceId);
    }
  }

  await stripe.subscriptions.cancel(subscriptionId);
}
