import { describe, expect, it, vi, beforeEach } from "vitest";

const couponsRetrieve = vi.fn();
const couponsCreate = vi.fn();
const subsUpdate = vi.fn();
const portalConfigList = vi.fn();
const portalConfigCreate = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    coupons: {
      retrieve: (...a: unknown[]) => couponsRetrieve(...a),
      create: (...a: unknown[]) => couponsCreate(...a),
    },
    subscriptions: { update: (...a: unknown[]) => subsUpdate(...a) },
    billingPortal: {
      configurations: {
        list: (...a: unknown[]) => portalConfigList(...a),
        create: (...a: unknown[]) => portalConfigCreate(...a),
      },
    },
  },
}));

import {
  ensureWinbackCoupon,
  applyAnnualWinback,
  applyDeferredWinback,
  applyWeeklyPause,
  deferAnnualWinback,
  setCancelAtPeriodEnd,
  ensurePortalConfiguration,
} from "@/lib/manage/stripeOps";

beforeEach(() => {
  couponsRetrieve.mockReset();
  couponsCreate.mockReset();
  subsUpdate.mockReset().mockResolvedValue({});
  portalConfigList.mockReset();
  portalConfigCreate.mockReset();
});

describe("ensureWinbackCoupon", () => {
  it("returns the existing coupon without creating", async () => {
    couponsRetrieve.mockResolvedValue({ id: "winback-annual-29" });
    expect(await ensureWinbackCoupon()).toBe("winback-annual-29");
    expect(couponsCreate).not.toHaveBeenCalled();
  });

  it("creates the coupon when missing", async () => {
    couponsRetrieve.mockRejectedValue({ code: "resource_missing" });
    couponsCreate.mockResolvedValue({ id: "winback-annual-29" });
    expect(await ensureWinbackCoupon()).toBe("winback-annual-29");
    expect(couponsCreate).toHaveBeenCalledWith({
      id: "winback-annual-29",
      amount_off: 2900,
      currency: "usd",
      duration: "once",
      name: "Winback: next year $0.99",
    });
  });
});

describe("offer and cancel operations", () => {
  it("applies the annual winback coupon and flags redemption in one update", async () => {
    couponsRetrieve.mockResolvedValue({ id: "winback-annual-29" });
    await applyAnnualWinback("sub_1");
    expect(subsUpdate).toHaveBeenCalledWith("sub_1", {
      discounts: [{ coupon: "winback-annual-29" }],
      metadata: { winback_redeemed: "1" },
    });
  });

  it("defers the trialing winback: redemption plus deferred marker, no discount", async () => {
    await deferAnnualWinback("sub_1");
    expect(subsUpdate).toHaveBeenCalledWith("sub_1", {
      metadata: { winback_redeemed: "1", winback_deferred: "1" },
    });
    expect(couponsRetrieve).not.toHaveBeenCalled();
    expect(couponsCreate).not.toHaveBeenCalled();
  });

  it("applies a deferred winback: attaches the coupon and clears the marker", async () => {
    couponsRetrieve.mockResolvedValue({ id: "winback-annual-29" });
    await applyDeferredWinback("sub_1");
    expect(subsUpdate).toHaveBeenCalledWith("sub_1", {
      discounts: [{ coupon: "winback-annual-29" }],
      metadata: { winback_deferred: "" },
    });
  });

  it("pauses weekly collection and flags redemption in one update", async () => {
    await applyWeeklyPause("sub_1", 1_800_000_000);
    expect(subsUpdate).toHaveBeenCalledWith("sub_1", {
      pause_collection: { behavior: "void", resumes_at: 1_800_000_000 },
      metadata: { pause_redeemed: "1" },
    });
  });

  it("sets and unsets cancel_at_period_end", async () => {
    await setCancelAtPeriodEnd("sub_1", true);
    expect(subsUpdate).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    await setCancelAtPeriodEnd("sub_1", false);
    expect(subsUpdate).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: false });
  });
});

describe("ensurePortalConfiguration", () => {
  it("reuses a configuration matching the metadata key", async () => {
    portalConfigList.mockResolvedValue({
      data: [{ id: "bpc_1", metadata: { v2p: "manage-default" } }],
    });
    expect(await ensurePortalConfiguration(false)).toBe("bpc_1");
    expect(portalConfigCreate).not.toHaveBeenCalled();
  });

  it("creates the cancel-enabled fallback configuration when missing", async () => {
    portalConfigList.mockResolvedValue({ data: [] });
    portalConfigCreate.mockResolvedValue({ id: "bpc_2" });
    expect(await ensurePortalConfiguration(true)).toBe("bpc_2");
    const arg = portalConfigCreate.mock.calls[0][0];
    expect(arg.metadata).toEqual({ v2p: "manage-cancel-fallback" });
    expect(arg.features.subscription_cancel).toEqual({
      enabled: true,
      mode: "at_period_end",
    });
  });
});
