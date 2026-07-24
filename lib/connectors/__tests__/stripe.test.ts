// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { list } = vi.hoisted(() => ({
  list: vi.fn(),
}));
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({ subscriptions: { list } }),
}));

import { fetchMetrics } from "@/lib/connectors/stripe";

beforeEach(() => {
  list.mockReset();
  vi.unstubAllEnvs();
});

describe("stripe.fetchMetrics: awaiting credentials", () => {
  it("returns awaiting_credentials when STRIPE_SECRET_KEY is unset", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const r = await fetchMetrics("2026-07");
    expect(r.status).toBe("awaiting_credentials");
    expect(r.data).toBeNull();
    expect(r.asOf).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });
});

describe("stripe.fetchMetrics: web free trials", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  });

  // Use a month that is always in the past relative to "now", so
  // resolveMonthWindow treats it as a closed window with a fixed end date.
  const PAST_MONTH = "2026-06";

  it("counts only subscriptions whose trial_start falls within the month window", async () => {
    // Window for 2026-06: from 2026-06-01T00:00:00Z to 2026-06-30T23:59:59.999Z.
    const windowStart = Date.UTC(2026, 5, 1) / 1000;
    const windowEnd = Math.floor(Date.UTC(2026, 5, 30, 23, 59, 59, 999) / 1000);

    list.mockResolvedValueOnce({
      data: [
        { id: "sub_1", trial_start: windowStart + 100, status: "trialing" },
        { id: "sub_2", trial_start: windowEnd - 100, status: "active" },
        { id: "sub_3", trial_start: null, status: "active" },
      ],
      has_more: false,
    });

    const r = await fetchMetrics(PAST_MONTH);

    expect(r.status).toBe("ok");
    expect(r.data?.webFreeTrials).toBe(2);
  });

  it("excludes subscriptions with trial_start outside the window", async () => {
    const windowEnd = Math.floor(Date.UTC(2026, 5, 30, 23, 59, 59, 999) / 1000);

    list.mockResolvedValueOnce({
      data: [
        { id: "sub_1", trial_start: windowEnd + 10_000, status: "trialing" },
      ],
      has_more: false,
    });

    const r = await fetchMetrics(PAST_MONTH);

    expect(r.status).toBe("ok");
    expect(r.data?.webFreeTrials).toBe(0);
  });

  it("paginates through has_more pages and sums matching subscriptions", async () => {
    const windowStart = Date.UTC(2026, 5, 1) / 1000;

    list
      .mockResolvedValueOnce({
        data: [{ id: "sub_1", trial_start: windowStart + 1, status: "trialing" }],
        has_more: true,
      })
      .mockResolvedValueOnce({
        data: [{ id: "sub_2", trial_start: windowStart + 2, status: "active" }],
        has_more: false,
      });

    const r = await fetchMetrics(PAST_MONTH);

    expect(r.status).toBe("ok");
    expect(r.data?.webFreeTrials).toBe(2);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("returns error status with a message when the Stripe call throws", async () => {
    list.mockRejectedValueOnce(new Error("stripe boom"));

    const r = await fetchMetrics(PAST_MONTH);

    expect(r.status).toBe("error");
    expect(r.data).toBeNull();
    expect(r.error).toContain("stripe boom");
  });

  it("sets asOf to the window end for a past month", async () => {
    list.mockResolvedValueOnce({ data: [], has_more: false });

    const r = await fetchMetrics(PAST_MONTH);

    expect(r.asOf).toBe(new Date("2026-06-30T00:00:00.000Z").toISOString());
  });

  it("omits webActiveSubs for a past month", async () => {
    list.mockResolvedValueOnce({ data: [], has_more: false });

    const r = await fetchMetrics(PAST_MONTH);

    expect(r.data?.webActiveSubs).toBeUndefined();
  });

  it("includes webActiveSubs (trialing + active) for the current month", async () => {
    list.mockResolvedValueOnce({
      data: [
        { id: "sub_1", trial_start: null, status: "trialing" },
        { id: "sub_2", trial_start: null, status: "active" },
        { id: "sub_3", trial_start: null, status: "canceled" },
      ],
      has_more: false,
    });

    const r = await fetchMetrics(undefined);

    expect(r.status).toBe("ok");
    expect(r.data?.webActiveSubs).toBe(2);
  });
});
