// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { subscriptionsRetrieve, subscriptionsCancel, invoicesRetrieve, invoicesVoid } = vi.hoisted(
  () => ({
    subscriptionsRetrieve: vi.fn(),
    subscriptionsCancel: vi.fn(async (_id: string) => ({})),
    invoicesRetrieve: vi.fn(),
    invoicesVoid: vi.fn(async (_id: string) => ({})),
  }),
);

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    subscriptions: { retrieve: subscriptionsRetrieve, cancel: subscriptionsCancel },
    invoices: { retrieve: invoicesRetrieve, voidInvoice: invoicesVoid },
  },
}));

import { cancelSubscriptionOnPaymentFailure } from "@/lib/stripe/paymentFailure";

beforeEach(() => {
  subscriptionsRetrieve.mockReset();
  subscriptionsCancel.mockClear();
  invoicesRetrieve.mockReset();
  invoicesVoid.mockClear();
});

describe("cancelSubscriptionOnPaymentFailure", () => {
  it("voids the open invoice, then cancels the subscription", async () => {
    subscriptionsRetrieve.mockResolvedValue({ id: "sub_1", status: "past_due" });
    invoicesRetrieve.mockResolvedValue({ id: "in_1", status: "open" });

    await cancelSubscriptionOnPaymentFailure("sub_1", "in_1");

    expect(invoicesVoid).toHaveBeenCalledWith("in_1");
    expect(subscriptionsCancel).toHaveBeenCalledWith("sub_1");
    // Void must happen before cancel: if cancel fails and Stripe redelivers,
    // the invoice is already dead and cannot collect from a card in the gap.
    expect(invoicesVoid.mock.invocationCallOrder[0]).toBeLessThan(
      subscriptionsCancel.mock.invocationCallOrder[0],
    );
  });

  it("does nothing when the subscription is already canceled (replayed delivery)", async () => {
    subscriptionsRetrieve.mockResolvedValue({ id: "sub_1", status: "canceled" });

    await cancelSubscriptionOnPaymentFailure("sub_1", "in_1");

    expect(invoicesRetrieve).not.toHaveBeenCalled();
    expect(invoicesVoid).not.toHaveBeenCalled();
    expect(subscriptionsCancel).not.toHaveBeenCalled();
  });

  it("still cancels when the invoice is no longer open (voided on a prior partial run)", async () => {
    subscriptionsRetrieve.mockResolvedValue({ id: "sub_1", status: "past_due" });
    invoicesRetrieve.mockResolvedValue({ id: "in_1", status: "void" });

    await cancelSubscriptionOnPaymentFailure("sub_1", "in_1");

    expect(invoicesVoid).not.toHaveBeenCalled();
    expect(subscriptionsCancel).toHaveBeenCalledWith("sub_1");
  });

  it("cancels without touching invoices when no invoice id is provided", async () => {
    subscriptionsRetrieve.mockResolvedValue({ id: "sub_1", status: "past_due" });

    await cancelSubscriptionOnPaymentFailure("sub_1", null);

    expect(invoicesRetrieve).not.toHaveBeenCalled();
    expect(subscriptionsCancel).toHaveBeenCalledWith("sub_1");
  });
});
