import { describe, it, expect } from "vitest";
import { mapEventToMutation, stripeStatusToLocal } from "@/lib/stripe/webhook";

const priceToPlan = { price_weekly: "weekly", price_annual: "annual" } as const;

describe("stripeStatusToLocal", () => {
  it("maps stripe statuses to local ones", () => {
    expect(stripeStatusToLocal("trialing")).toBe("trialing");
    expect(stripeStatusToLocal("active")).toBe("active");
    expect(stripeStatusToLocal("past_due")).toBe("past_due");
    expect(stripeStatusToLocal("canceled")).toBe("canceled");
    expect(stripeStatusToLocal("unpaid")).toBe("past_due");
  });
});

describe("mapEventToMutation", () => {
  it("upserts from customer.subscription.created", () => {
    const m = mapEventToMutation({
      type: "customer.subscription.created",
      data: { object: {
        customer: "cus_1", id: "sub_1", status: "trialing",
        current_period_end: 1_800_000_000, trial_end: 1_790_000_000,
        items: { data: [{ price: { id: "price_weekly" } }] },
        metadata: { email: "a@b.com" },
      } },
    }, priceToPlan);
    expect(m.kind).toBe("upsert");
    if (m.kind !== "upsert") throw new Error("expected upsert");
    expect(m.input.email).toBe("a@b.com");
    expect(m.input.plan).toBe("weekly");
    expect(m.input.status).toBe("trialing");
    expect(m.input.currentPeriodEnd).toBe(1_800_000_000 * 1000);
  });

  it("marks canceled from customer.subscription.deleted", () => {
    const m = mapEventToMutation({
      type: "customer.subscription.deleted",
      data: { object: {
        customer: "cus_1", id: "sub_1", status: "canceled",
        current_period_end: 1_800_000_000, trial_end: null,
        items: { data: [{ price: { id: "price_annual" } }] },
        metadata: { email: "a@b.com" },
      } },
    }, priceToPlan);
    if (m.kind !== "upsert") throw new Error("expected upsert");
    expect(m.input.status).toBe("canceled");
    expect(m.input.plan).toBe("annual");
  });

  it("returns none for unrelated events", () => {
    expect(mapEventToMutation({ type: "invoice.created", data: { object: {} } }, priceToPlan).kind).toBe("none");
  });
});
