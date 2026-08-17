import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  track,
  trackCustom,
  identify,
  trackMetaPageView,
  trackTikTokPageView,
} from "@/lib/pixel/events";

beforeEach(() => {
  (globalThis as any).fbq = vi.fn();
  (globalThis as any).ttq = { track: vi.fn(), page: vi.fn(), identify: vi.fn() };
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

  it("also forwards to ttq, mapping Purchase onto CompletePayment", () => {
    track("Purchase", { value: 4.99, currency: "USD" }, "evt_1");
    expect((globalThis as any).ttq.track).toHaveBeenCalledWith(
      "CompletePayment",
      { value: 4.99, currency: "USD" },
      { event_id: "evt_1" }
    );
  });

  it("sends StartTrial to TikTok unchanged, since it is a standard event there too", () => {
    track("StartTrial", { value: 29.99, currency: "USD" });
    expect((globalThis as any).ttq.track).toHaveBeenCalledWith(
      "StartTrial",
      { value: 29.99, currency: "USD" },
      {}
    );
  });

  it("keeps shared event names unchanged for TikTok", () => {
    track("Lead");
    expect((globalThis as any).ttq.track).toHaveBeenCalledWith("Lead", {}, {});
  });

  it("routes PageView to ttq.page rather than ttq.track", () => {
    track("PageView");
    expect((globalThis as any).ttq.page).toHaveBeenCalled();
    expect((globalThis as any).ttq.track).not.toHaveBeenCalled();
  });

  it("still reports to TikTok when the Meta pixel is absent", () => {
    (globalThis as any).fbq = undefined;
    track("Lead");
    expect((globalThis as any).ttq.track).toHaveBeenCalledWith("Lead", {}, {});
  });

  it("no-ops safely when ttq is undefined", () => {
    (globalThis as any).ttq = undefined;
    expect(() => track("Purchase", { value: 1 }, "e")).not.toThrow();
    expect((globalThis as any).fbq).toHaveBeenCalled();
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

  it("forwards custom events to ttq.track under the same name", () => {
    trackCustom("funnel_opened", { source: "direct" });
    expect((globalThis as any).ttq.track).toHaveBeenCalledWith("funnel_opened", {
      source: "direct",
    });
  });

  it("no-ops safely when ttq is undefined", () => {
    (globalThis as any).ttq = undefined;
    expect(() => trackCustom("funnel_opened")).not.toThrow();
  });
});

describe("identify", () => {
  it("passes a lowercased, trimmed email to ttq.identify", () => {
    identify("  A@B.COM  ");
    expect((globalThis as any).ttq.identify).toHaveBeenCalledWith({ email: "a@b.com" });
  });

  it("no-ops safely when ttq is undefined", () => {
    (globalThis as any).ttq = undefined;
    expect(() => identify("a@b.com")).not.toThrow();
  });
});

describe("per-network page views", () => {
  it("trackMetaPageView hits fbq only", () => {
    trackMetaPageView();
    expect((globalThis as any).fbq).toHaveBeenCalledWith("track", "PageView");
    expect((globalThis as any).ttq.page).not.toHaveBeenCalled();
  });

  it("trackTikTokPageView hits ttq only", () => {
    trackTikTokPageView();
    expect((globalThis as any).ttq.page).toHaveBeenCalled();
    expect((globalThis as any).fbq).not.toHaveBeenCalled();
  });

  it("both no-op safely when their SDK is absent", () => {
    (globalThis as any).fbq = undefined;
    (globalThis as any).ttq = undefined;
    expect(() => trackMetaPageView()).not.toThrow();
    expect(() => trackTikTokPageView()).not.toThrow();
  });
});
