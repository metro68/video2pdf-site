// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Loosely typed mock Stripe session shape: only the fields the page reads.
// Kept permissive (not the full Stripe.Checkout.Session type) so each test can
// supply just the fields it cares about.
interface MockSession {
  id: string;
  amount_total: number;
  customer?: string | null;
  customer_details?: { email: string | null } | null;
  metadata?: { redeem_token?: string; email?: string };
  subscription?: {
    id?: string;
    metadata?: { redeem_token?: string };
    items: { data: [{ price: { id: string } }] };
  };
}

const { retrieve } = vi.hoisted(() => ({
  retrieve: vi.fn<(..._a: unknown[]) => Promise<MockSession>>(async () => ({
    id: "cs_test_123",
    amount_total: 0,
    metadata: {},
    subscription: {
      metadata: { redeem_token: "tok_abc" },
      items: { data: [{ price: { id: "price_annual" } }] },
    },
  })),
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: { checkout: { sessions: { retrieve } } },
  PRICE_TO_PLAN: { price_weekly: "weekly", price_annual: "annual" },
}));

const { upsertSubscription, getOrCreateRedeemTokenForEmail } = vi.hoisted(() => ({
  upsertSubscription: vi.fn(async (_input: Record<string, unknown>) => {}),
  getOrCreateRedeemTokenForEmail: vi.fn(
    async (_email: string, _ttlMs: number, _newToken: string) => "MOCK-CODE",
  ),
}));

vi.mock("@/lib/db/subscriptions", () => ({ upsertSubscription, getOrCreateRedeemTokenForEmail }));
vi.mock("@/lib/db/redeemCode", () => ({ generateRedeemCode: () => "GEN-CODE" }));

import SuccessPage from "@/app/go/success/page";

beforeEach(() => {
  retrieve.mockClear();
  upsertSubscription.mockClear();
  getOrCreateRedeemTokenForEmail.mockClear();
});

describe("SuccessPage", () => {
  it("uses the annual catalog value (29.99) even though amount_total is 0 during the trial", async () => {
    retrieve.mockResolvedValue({
      id: "cs_test_123",
      amount_total: 0,
      metadata: {},
      subscription: {
        metadata: { redeem_token: "tok_abc" },
        items: { data: [{ price: { id: "price_annual" } }] },
      },
    });
    const element = await SuccessPage({ searchParams: Promise.resolve({ session_id: "cs_test_123" }) });
    expect(element.props.value).toBe(29.99);
    expect(element.props.token).toBe("tok_abc");
    expect(element.props.eventId).toBe("cs_test_123");
  });

  it("uses the weekly catalog value (4.99) when the session is for the weekly plan", async () => {
    retrieve.mockResolvedValue({
      id: "cs_test_456",
      amount_total: 499,
      metadata: {},
      subscription: {
        metadata: { redeem_token: "tok_def" },
        items: { data: [{ price: { id: "price_weekly" } }] },
      },
    });
    const element = await SuccessPage({ searchParams: Promise.resolve({ session_id: "cs_test_456" }) });
    expect(element.props.value).toBe(4.99);
  });

  it("returns a zero value and empty token when there is no session id", async () => {
    const element = await SuccessPage({ searchParams: Promise.resolve({}) });
    expect(element.props.value).toBe(0);
    expect(element.props.token).toBe("");
    expect(element.props.eventId).toBe("");
  });

  it("get-or-creates a redeem code server-side when the session has a customer email", async () => {
    retrieve.mockResolvedValue({
      id: "cs_test_789",
      amount_total: 0,
      customer: "cus_123",
      customer_details: { email: "Person@Example.com" },
      metadata: {},
      subscription: {
        id: "sub_123",
        metadata: {},
        items: { data: [{ price: { id: "price_annual" } }] },
      },
    } as MockSession);
    const element = await SuccessPage({ searchParams: Promise.resolve({ session_id: "cs_test_789" }) });
    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "person@example.com",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        plan: "annual",
      }),
    );
    expect(getOrCreateRedeemTokenForEmail).toHaveBeenCalledWith(
      "person@example.com",
      expect.any(Number),
      "GEN-CODE",
    );
    expect(element.props.token).toBe("MOCK-CODE");
  });

  it("falls back to the metadata token when minting the redeem code fails", async () => {
    getOrCreateRedeemTokenForEmail.mockRejectedValueOnce(new Error("db down"));
    retrieve.mockResolvedValue({
      id: "cs_test_999",
      amount_total: 0,
      customer: "cus_999",
      customer_details: { email: "fallback@example.com" },
      metadata: { redeem_token: "tok_fallback" },
      subscription: {
        id: "sub_999",
        metadata: {},
        items: { data: [{ price: { id: "price_annual" } }] },
      },
    } as MockSession);
    const element = await SuccessPage({ searchParams: Promise.resolve({ session_id: "cs_test_999" }) });
    expect(element.props.token).toBe("tok_fallback");
  });
});
