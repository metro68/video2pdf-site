import { describe, it, expect, vi, beforeEach } from "vitest";
import { track, trackCustom } from "@/lib/pixel/events";

beforeEach(() => {
  (globalThis as any).fbq = vi.fn();
});

describe("track", () => {
  it("forwards to fbq with event and params", () => {
    track("InitiateCheckout", { value: 4.99, currency: "USD" });
    expect((globalThis as any).fbq).toHaveBeenCalledWith("track", "InitiateCheckout", {
      value: 4.99,
      currency: "USD",
    });
  });

  it("forwards a StartTrial event with predicted_ltv params", () => {
    track("StartTrial", { value: 29.99, currency: "USD", predicted_ltv: 29.99 });
    expect((globalThis as any).fbq).toHaveBeenCalledWith("track", "StartTrial", {
      value: 29.99,
      currency: "USD",
      predicted_ltv: 29.99,
    });
  });

  it("passes eventID as the 4th arg when provided", () => {
    track("Purchase", { value: 4.99, currency: "USD" }, "evt_1");
    expect((globalThis as any).fbq).toHaveBeenCalledWith(
      "track",
      "Purchase",
      { value: 4.99, currency: "USD" },
      { eventID: "evt_1" }
    );
  });

  it("no-ops safely when fbq is undefined", () => {
    (globalThis as any).fbq = undefined;
    expect(() => track("PageView")).not.toThrow();
  });
});

describe("trackCustom", () => {
  it("forwards to fbq trackCustom with name and params", () => {
    trackCustom("funnel_opened", { source: "direct" });
    expect((globalThis as any).fbq).toHaveBeenCalledWith("trackCustom", "funnel_opened", {
      source: "direct",
    });
  });

  it("forwards an empty params object when none provided", () => {
    trackCustom("funnel_get_started");
    expect((globalThis as any).fbq).toHaveBeenCalledWith("trackCustom", "funnel_get_started", {});
  });

  it("no-ops safely when fbq is undefined", () => {
    (globalThis as any).fbq = undefined;
    expect(() => trackCustom("funnel_opened")).not.toThrow();
  });
});
