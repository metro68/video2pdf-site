// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  constructEvent,
  upsertSubscription,
  mintRedeemToken,
  sendCapiPurchase,
  subscriptionsRetrieve,
  subscriptionsUpdate,
} = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  upsertSubscription: vi.fn(async () => {}),
  mintRedeemToken: vi.fn(async (_email: string, _ttlMs: number, token: string) => token),
  sendCapiPurchase: vi.fn(
    async (_input: { email: string; value: number; currency: string; eventId: string }) => {},
  ),
  subscriptionsRetrieve: vi.fn(async (_id: string) => ({ metadata: {} as Record<string, string> })),
  subscriptionsUpdate: vi.fn(
    async (_id: string, _params: { metadata: Record<string, string> }) => ({}),
  ),
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    webhooks: { constructEvent },
    subscriptions: { retrieve: subscriptionsRetrieve, update: subscriptionsUpdate },
  },
  PRICE_TO_PLAN: { price_weekly: "weekly" },
}));
vi.mock("@/lib/db/subscriptions", () => ({ upsertSubscription, mintRedeemToken }));
vi.mock("@/lib/pixel/capi", () => ({ sendCapiPurchase }));
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");

import { POST } from "@/app/api/stripe/webhook/route";

beforeEach(() => {
  constructEvent.mockReset();
  upsertSubscription.mockClear();
  mintRedeemToken.mockClear();
  sendCapiPurchase.mockClear();
  subscriptionsRetrieve.mockReset();
  subscriptionsRetrieve.mockResolvedValue({ metadata: {} });
  subscriptionsUpdate.mockClear();
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
          current_period_end: 1_800_000_000,
          trial_end: null,
          items: { data: [{ price: { id: "price_weekly" } }] },
          metadata: { email: "a@b.com" },
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(upsertSubscription).toHaveBeenCalledTimes(1);
  });

  it("mints a token and sends CAPI Purchase on checkout.session.completed, keyed by the session id", async () => {
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

  it("does not mint a second token or resend CAPI on a replayed checkout.session.completed", async () => {
    subscriptionsRetrieve.mockResolvedValue({ metadata: { redeem_token: "tok_already_minted" } });
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
});
