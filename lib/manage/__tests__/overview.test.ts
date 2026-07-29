import { describe, expect, it } from "vitest";
import {
  mapSubscriptionToOverview,
  pickRelevantSubscription,
  type StripeSubLike,
} from "@/lib/manage/overview";

const PRICE_TO_PLAN = { price_w: "weekly", price_a: "annual" } as const;

function sub(over: Partial<StripeSubLike> = {}): StripeSubLike {
  return {
    id: "sub_1",
    status: "active",
    cancel_at_period_end: false,
    created: 100,
    metadata: {},
    items: { data: [{ price: { id: "price_a" }, current_period_end: 1_800_000_000 }] },
    ...over,
  };
}

describe("mapSubscriptionToOverview", () => {
  it("maps an active annual subscription with the offer available", () => {
    const o = mapSubscriptionToOverview(sub(), PRICE_TO_PLAN);
    expect(o).toMatchObject({
      plan: "annual",
      priceLabel: "$29.99",
      trialing: false,
      pastDue: false,
      winbackRedeemed: false,
      pauseRedeemed: false,
      offerAvailable: true,
      currentPeriodEnd: 1_800_000_000_000,
    });
  });

  it("reads redemption flags from metadata and withdraws the offer", () => {
    const o = mapSubscriptionToOverview(
      sub({ metadata: { winback_redeemed: "1" } }),
      PRICE_TO_PLAN,
    );
    expect(o?.winbackRedeemed).toBe(true);
    expect(o?.offerAvailable).toBe(false);
  });

  it("withdraws the offer for past_due", () => {
    const o = mapSubscriptionToOverview(sub({ status: "past_due" }), PRICE_TO_PLAN);
    expect(o?.pastDue).toBe(true);
    expect(o?.offerAvailable).toBe(false);
  });

  it("keeps the offer for trialing when offerToTrialing is true", () => {
    const o = mapSubscriptionToOverview(sub({ status: "trialing" }), PRICE_TO_PLAN);
    expect(o?.trialing).toBe(true);
    expect(o?.offerAvailable).toBe(true);
  });

  it("maps weekly via its price id and pause_redeemed flag", () => {
    const o = mapSubscriptionToOverview(
      sub({
        items: { data: [{ price: { id: "price_w" }, current_period_end: 1_800_000_000 }] },
        metadata: { pause_redeemed: "1" },
      }),
      PRICE_TO_PLAN,
    );
    expect(o?.plan).toBe("weekly");
    expect(o?.offerAvailable).toBe(false);
  });

  it("returns null for an unknown price id", () => {
    const o = mapSubscriptionToOverview(
      sub({ items: { data: [{ price: { id: "price_x" }, current_period_end: 1 }] } }),
      PRICE_TO_PLAN,
    );
    expect(o).toBeNull();
  });
});

describe("pickRelevantSubscription", () => {
  it("prefers a live subscription over a canceled one", () => {
    const canceled = sub({ id: "sub_old", status: "canceled", created: 200 });
    const live = sub({ id: "sub_live", created: 50 });
    expect(pickRelevantSubscription([canceled, live])?.id).toBe("sub_live");
  });

  it("picks the newest live subscription", () => {
    const a = sub({ id: "sub_a", created: 100 });
    const b = sub({ id: "sub_b", created: 300 });
    expect(pickRelevantSubscription([a, b])?.id).toBe("sub_b");
  });

  it("returns null when everything is canceled", () => {
    expect(pickRelevantSubscription([sub({ status: "canceled" })])).toBeNull();
  });
});
