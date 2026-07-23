import { describe, it, expect, vi, beforeEach } from "vitest";
import { track } from "@/lib/pixel/events";

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
