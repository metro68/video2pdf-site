// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  constructEvent,
  upsertSubscription,
  mintRedeemToken,
  sendCapiPurchase,
  sendCapiStartTrial,
  subscriptionsRetrieve,
  subscriptionsUpdate,
} = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  upsertSubscription: vi.fn(async (_input: Record<string, unknown>) => {}),
  mintRedeemToken: vi.fn(async (_email: string, _ttlMs: number, token: string) => token),
  sendCapiPurchase: vi.fn(
    async (_input: { email: string; value: number; currency: string; eventId: string }) => {},
  ),
  sendCapiStartTrial: vi.fn(
    async (_input: { email: string; value: number; currency: string; eventId: string }) => {},
  ),
  subscriptionsRetrieve: vi.fn(async (_id: string) => ({
    metadata: {} as Record<string, string>,
    items: { data: [{ price: { id: "price_weekly" } }] } as {
      data: { price: { id: string } }[];
    },
  })),
  subscriptionsUpdate: vi.fn(
    async (_id: string, _params: { metadata: Record<string, string> }) => ({}),
  ),
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    webhooks: { constructEvent },
    subscriptions: { retrieve: subscriptionsRetrieve, update: subscriptionsUpdate },
  },
  PRICE_TO_PLAN: { price_weekly: "weekly", price_annual: "annual" },
}));
vi.mock("@/lib/db/subscriptions", () => ({ upsertSubscription, mintRedeemToken }));
vi.mock("@/lib/pixel/capi", () => ({ sendCapiPurchase, sendCapiStartTrial }));
const applyDeferredWinback = vi.hoisted(() => vi.fn(async (_id: string) => {}));
vi.mock("@/lib/manage/stripeOps", () => ({
  applyDeferredWinback: (id: string) => applyDeferredWinback(id),
}));
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");

import { POST } from "@/app/api/stripe/webhook/route";

beforeEach(() => {
  constructEvent.mockReset();
  upsertSubscription.mockClear();
  mintRedeemToken.mockClear();
  sendCapiPurchase.mockClear();
  sendCapiStartTrial.mockClear();
  subscriptionsRetrieve.mockReset();
  subscriptionsRetrieve.mockResolvedValue({
    metadata: {},
    items: { data: [{ price: { id: "price_weekly" } }] },
  });
  subscriptionsUpdate.mockClear();
  applyDeferredWinback.mockClear();
});

function req(sig = "sig") {
  return new Request("https://video2pdf.ai/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig },
    body: "{}",
  });
}

describe("POST /api/stripe/webhook", () => {
  it("400s on invalid signature", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await POST(req());
    expect(res.status).toBe(400);
  });

  it("upserts on customer.subscription.created", async () => {
    constructEvent.mockReturnValue({
      type: "customer.subscription.created",
      data: {
        object: {
          customer: "cus_1",
          id: "sub_1",
          status: "trialing",
          trial_end: null,
          items: { data: [{ price: { id: "price_weekly" }, current_period_end: 1_800_000_000 }] },
          metadata: { email: "a@b.com" },
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(upsertSubscription).toHaveBeenCalledTimes(1);
  });

  it("mints a token and sends CAPI Purchase with the weekly catalog value on checkout.session.completed, keyed by the session id", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      metadata: {},
      items: { data: [{ price: { id: "price_weekly" } }] },
    });
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      id: "evt_9",
      data: {
        object: {
          id: "cs_test_123",
          customer: "cus_1",
          subscription: "sub_1",
          customer_details: { email: "a@b.com" },
          amount_total: 499,
          currency: "usd",
          metadata: { email: "a@b.com" },
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mintRedeemToken).toHaveBeenCalledTimes(1);
    expect(sendCapiPurchase).toHaveBeenCalledTimes(1);
    const arg = sendCapiPurchase.mock.calls[0][0];
    expect(arg.value).toBe(4.99);
    expect(arg.currency).toBe("USD");
    expect(arg.eventId).toBe("cs_test_123");

    // Persists the freshly minted token to the subscription's metadata so the
    // success page can read it back via the Checkout Session id. The same
    // token value must be passed to both mintRedeemToken and the metadata write.
    expect(subscriptionsUpdate).toHaveBeenCalledTimes(1);
    const [subId, updateArg] = subscriptionsUpdate.mock.calls[0];
    expect(subId).toBe("sub_1");
    const mintedToken = mintRedeemToken.mock.calls[0][2];
    expect(updateArg.metadata.redeem_token).toBe(mintedToken);
    expect(updateArg.metadata.email).toBe("a@b.com");
  });

  it("sends CAPI StartTrial only (no Purchase) on annual checkout.session.completed: the card is not charged during the trial", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      metadata: {},
      items: { data: [{ price: { id: "price_annual" } }] },
    });
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      id: "evt_20",
      data: {
        object: {
          id: "cs_test_trial",
          customer: "cus_5",
          subscription: "sub_5",
          customer_details: { email: "a@b.com" },
          amount_total: 0,
          currency: "usd",
          metadata: { email: "a@b.com" },
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(sendCapiPurchase).not.toHaveBeenCalled();
    expect(sendCapiStartTrial).toHaveBeenCalledTimes(1);
    const arg = sendCapiStartTrial.mock.calls[0][0];
    expect(arg.email).toBe("a@b.com");
    expect(arg.value).toBe(29.99);
    expect(arg.currency).toBe("USD");
    expect(arg.eventId).toBe("cs_test_trial");
  });

  it("sends CAPI Purchase with the charged amount on invoice.paid, keyed by the invoice id, with fbp/fbc from subscription metadata", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      metadata: { email: "a@b.com", fbp: "fb.1.1.2", fbc: "fb.1.1.click" },
      items: { data: [{ price: { id: "price_annual" } }] },
    });
    constructEvent.mockReturnValue({
      type: "invoice.paid",
      id: "evt_30",
      data: {
        object: {
          id: "in_conv_1",
          subscription: "sub_5",
          amount_paid: 2999,
          currency: "usd",
          billing_reason: "subscription_cycle",
          customer_email: "a@b.com",
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(sendCapiStartTrial).not.toHaveBeenCalled();
    expect(sendCapiPurchase).toHaveBeenCalledTimes(1);
    const arg = sendCapiPurchase.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.value).toBe(29.99);
    expect(arg.currency).toBe("USD");
    expect(arg.eventId).toBe("in_conv_1");
    expect(arg.fbp).toBe("fb.1.1.2");
    expect(arg.fbc).toBe("fb.1.1.click");
  });

  it("applies the deferred winback coupon on invoice.paid when the subscription carries the marker", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      metadata: { email: "a@b.com", winback_deferred: "1" },
      items: { data: [{ price: { id: "price_annual" } }] },
    });
    constructEvent.mockReturnValue({
      type: "invoice.paid",
      id: "evt_33",
      data: {
        object: {
          id: "in_conv_2",
          subscription: "sub_7",
          amount_paid: 2999,
          currency: "usd",
          billing_reason: "subscription_cycle",
          customer_email: "a@b.com",
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(applyDeferredWinback).toHaveBeenCalledWith("sub_7");
    // The conversion Purchase still fires alongside the deferred application.
    expect(sendCapiPurchase).toHaveBeenCalledTimes(1);
  });

  it("does not apply the deferred winback on invoice.paid without the marker", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      metadata: { email: "a@b.com" },
      items: { data: [{ price: { id: "price_annual" } }] },
    });
    constructEvent.mockReturnValue({
      type: "invoice.paid",
      id: "evt_34",
      data: {
        object: {
          id: "in_conv_3",
          subscription: "sub_7",
          amount_paid: 2999,
          currency: "usd",
          billing_reason: "subscription_cycle",
          customer_email: "a@b.com",
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(applyDeferredWinback).not.toHaveBeenCalled();
  });

  it("does not send CAPI on invoice.paid for the checkout-time invoice (subscription_create): that charge is already reported at checkout", async () => {
    constructEvent.mockReturnValue({
      type: "invoice.paid",
      id: "evt_31",
      data: {
        object: {
          id: "in_create_1",
          subscription: "sub_6",
          amount_paid: 499,
          currency: "usd",
          billing_reason: "subscription_create",
          customer_email: "a@b.com",
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(sendCapiPurchase).not.toHaveBeenCalled();
  });

  it("does not send CAPI on a zero-amount invoice.paid (trial-start invoice)", async () => {
    constructEvent.mockReturnValue({
      type: "invoice.paid",
      id: "evt_32",
      data: {
        object: {
          id: "in_zero_1",
          subscription: "sub_5",
          amount_paid: 0,
          currency: "usd",
          billing_reason: "subscription_cycle",
          customer_email: "a@b.com",
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(sendCapiPurchase).not.toHaveBeenCalled();
  });

  it("does not send CAPI StartTrial on checkout.session.completed for the weekly plan, since weekly has no trial", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      metadata: {},
      items: { data: [{ price: { id: "price_weekly" } }] },
    });
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      id: "evt_21",
      data: {
        object: {
          id: "cs_test_weekly_notrial",
          customer: "cus_6",
          subscription: "sub_6",
          customer_details: { email: "a@b.com" },
          amount_total: 499,
          currency: "usd",
          metadata: { email: "a@b.com" },
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(sendCapiPurchase).toHaveBeenCalledTimes(1);
    expect(sendCapiStartTrial).not.toHaveBeenCalled();
  });

  it("does not resend CAPI StartTrial on a replayed annual checkout.session.completed", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      metadata: { redeem_token: "tok_already_minted" },
      items: { data: [{ price: { id: "price_annual" } }] },
    });
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      id: "evt_22",
      data: {
        object: {
          id: "cs_test_trial_replay",
          customer: "cus_5",
          subscription: "sub_5",
          customer_details: { email: "a@b.com" },
          amount_total: 0,
          currency: "usd",
          metadata: { email: "a@b.com" },
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(sendCapiStartTrial).not.toHaveBeenCalled();
    expect(sendCapiPurchase).not.toHaveBeenCalled();
  });

  it("lowercases and trims the email used for the token, subscription metadata, and CAPI identity", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      id: "evt_11",
      data: {
        object: {
          id: "cs_test_case",
          customer: "cus_1",
          subscription: "sub_1",
          customer_details: { email: "  A@B.COM  " },
          amount_total: 499,
          currency: "usd",
          metadata: { email: "  A@B.COM  " },
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mintRedeemToken).toHaveBeenCalledWith("a@b.com", expect.any(Number), expect.any(String));
    const [, updateArg] = subscriptionsUpdate.mock.calls[0];
    expect(updateArg.metadata.email).toBe("a@b.com");
    const arg = sendCapiPurchase.mock.calls[0][0];
    expect(arg.email).toBe("a@b.com");
  });

  it("does not mint a second token or resend CAPI on a replayed checkout.session.completed", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      metadata: { redeem_token: "tok_already_minted" },
      items: { data: [{ price: { id: "price_weekly" } }] },
    });
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      id: "evt_9",
      data: {
        object: {
          id: "cs_test_123",
          customer: "cus_1",
          subscription: "sub_1",
          customer_details: { email: "a@b.com" },
          amount_total: 499,
          currency: "usd",
          metadata: { email: "a@b.com" },
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mintRedeemToken).not.toHaveBeenCalled();
    expect(sendCapiPurchase).not.toHaveBeenCalled();
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("upserts a minimal subscriptions row before minting the token, so the redeem_tokens FK is satisfiable even if completed arrives before customer.subscription.*", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      id: "evt_12",
      data: {
        object: {
          id: "cs_test_fk",
          customer: "cus_3",
          subscription: "sub_3",
          customer_details: { email: "a@b.com" },
          amount_total: 499,
          currency: "usd",
          metadata: { email: "a@b.com" },
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(upsertSubscription).toHaveBeenCalled();
    const upsertArg = upsertSubscription.mock.calls[0][0];
    expect(upsertArg.email).toBe("a@b.com");

    // The FK-satisfying upsert must happen before the token mint, not after.
    const upsertOrder = upsertSubscription.mock.invocationCallOrder[0];
    const mintOrder = mintRedeemToken.mock.invocationCallOrder[0];
    expect(upsertOrder).toBeLessThan(mintOrder);
  });
});
