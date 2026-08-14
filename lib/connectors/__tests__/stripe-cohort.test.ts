// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => ({ subscriptions: { list } }) }));

import { classifyTrial, fetchTrialCohort } from "@/lib/connectors/stripe";

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 7, 14) / 1000); // 2026-08-14T00:00:00Z

function sub(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "trialing",
    trial_start: NOW - 1 * DAY,
    items: { data: [{ price: { unit_amount: 2999, recurring: { interval: "year" } }, quantity: 1 }] },
    ...overrides,
  };
}

describe("classifyTrial", () => {
  it("fresh trialing sub is pending and not decided", () => {
    const t = classifyTrial(sub(), NOW, 3);
    expect(t.outcome).toBe("pending");
    expect(t.decided).toBe(false);
    expect(t.priceUsd).toBeCloseTo(29.99);
  });

  it("active sub past its window is a decided payer", () => {
    const t = classifyTrial(sub({ status: "active", trial_start: NOW - 5 * DAY }), NOW, 3);
    expect(t.outcome).toBe("paid");
    expect(t.decided).toBe(true);
  });

  it("early cancellation is decided even inside the window", () => {
    const t = classifyTrial(sub({ status: "canceled", trial_start: NOW - 1 * DAY }), NOW, 3);
    expect(t.outcome).toBe("canceled");
    expect(t.decided).toBe(true);
  });

  it("past_due is decided but not a payer", () => {
    const t = classifyTrial(sub({ status: "past_due", trial_start: NOW - 5 * DAY }), NOW, 3);
    expect(t.outcome).toBe("past_due");
    expect(t.decided).toBe(true);
  });

  it("boundary: decided flips exactly at trial_start + trialDays", () => {
    expect(classifyTrial(sub({ trial_start: NOW - 3 * DAY }), NOW, 3).decided).toBe(true);
    expect(classifyTrial(sub({ trial_start: NOW - 3 * DAY + 1 }), NOW, 3).decided).toBe(false);
  });
});

describe("fetchTrialCohort", () => {
  beforeEach(() => {
    list.mockReset();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  });

  it("aggregates outcomes and daily counts over the window", async () => {
    list.mockResolvedValueOnce({
      data: [
        sub({ id: "a", status: "active", trial_start: NOW - 6 * DAY }),
        sub({ id: "b", status: "canceled", trial_start: NOW - 6 * DAY }),
        sub({ id: "c", status: "trialing", trial_start: NOW - 1 * DAY }),
        sub({ id: "d", status: "trialing", trial_start: NOW - 40 * DAY }), // outside window, dropped
      ],
      has_more: false,
    });
    const r = await fetchTrialCohort("2026-08-01", "2026-08-14");
    expect(r.status).toBe("ok");
    const agg = r.data!.aggregates;
    expect(agg.trials).toBe(3);
    expect(agg.payers).toBe(1);
    expect(agg.canceled).toBe(1);
    expect(agg.pending).toBe(1);
    expect(agg.decided).toBe(2);
    expect(agg.collectedUsd).toBeCloseTo(29.99);
    expect(r.data!.dailyTrials.find((d) => d.date === "2026-08-08")?.count).toBe(2);
  });

  it("returns awaiting_credentials without a key", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const r = await fetchTrialCohort("2026-08-01", "2026-08-14");
    expect(r.status).toBe("awaiting_credentials");
  });
});
