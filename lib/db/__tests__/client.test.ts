import { describe, it, expect } from "vitest";
import { mapSubscriptionRow, mapRedeemTokenRow } from "@/lib/db/client";

describe("mapSubscriptionRow", () => {
  it("maps snake_case row to typed camelCase with epoch ms", () => {
    const row = mapSubscriptionRow({
      email: "a@b.com",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      plan: "weekly",
      status: "trialing",
      current_period_end: new Date("2026-08-01T00:00:00Z"),
      trial_end: new Date("2026-07-26T00:00:00Z"),
      created_at: new Date("2026-07-23T00:00:00Z"),
      updated_at: new Date("2026-07-23T00:00:00Z"),
    });
    expect(row.email).toBe("a@b.com");
    expect(row.plan).toBe("weekly");
    expect(row.status).toBe("trialing");
    expect(row.currentPeriodEnd).toBe(Date.parse("2026-08-01T00:00:00Z"));
  });
});

describe("mapRedeemTokenRow", () => {
  it("maps a token row and preserves null consumed_at", () => {
    const t = mapRedeemTokenRow({
      token: "tok_1",
      email: "a@b.com",
      created_at: new Date("2026-07-23T00:00:00Z"),
      expires_at: new Date("2026-07-30T00:00:00Z"),
      consumed_at: null,
    });
    expect(t.token).toBe("tok_1");
    expect(t.consumedAt).toBeNull();
  });
});
