// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { constructEvent, upsertSubscription, mintRedeemToken, sendCapiPurchase } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  upsertSubscription: vi.fn(async () => {}),
  mintRedeemToken: vi.fn(async () => "tok_1"),
  sendCapiPurchase: vi.fn(
    async (_input: { email: string; value: number; currency: string; eventId: string }) => {},
  ),
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: { webhooks: { constructEvent } },
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

  it("mints a token and sends CAPI Purchase on checkout.session.completed", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      id: "evt_9",
      data: {
        object: {
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
    expect(arg.eventId).toBe("evt_9");
  });
});
