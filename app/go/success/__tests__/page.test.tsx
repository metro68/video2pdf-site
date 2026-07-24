// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { retrieve } = vi.hoisted(() => ({
  retrieve: vi.fn(async (..._a: unknown[]) => ({
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

import SuccessPage from "@/app/go/success/page";

beforeEach(() => retrieve.mockClear());

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
});
