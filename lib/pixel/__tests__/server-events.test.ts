import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/pixel/capi", () => ({
  sendCapiPurchase: vi.fn(async () => {}),
  sendCapiStartTrial: vi.fn(async () => {}),
}));
vi.mock("@/lib/pixel/tiktok-capi", () => ({
  sendTikTokPurchase: vi.fn(async () => {}),
  sendTikTokStartTrial: vi.fn(async () => {}),
}));

import { reportPurchase, reportStartTrial } from "@/lib/pixel/server-events";
import { sendCapiPurchase, sendCapiStartTrial } from "@/lib/pixel/capi";
import { sendTikTokPurchase, sendTikTokStartTrial } from "@/lib/pixel/tiktok-capi";

const input = {
  email: "a@b.com",
  value: 29.99,
  currency: "USD",
  eventId: "evt_1",
  fbp: "fb.1.1.2",
  fbc: "fb.1.1.IwAR3",
  ttp: "ttp-abc",
  ttclid: "E.C.P.click123",
};

beforeEach(() => vi.clearAllMocks());

describe("reportPurchase", () => {
  it("reports to both networks, routing each its own identifiers", async () => {
    await reportPurchase(input);
    expect(sendCapiPurchase).toHaveBeenCalledWith({
      email: "a@b.com",
      value: 29.99,
      currency: "USD",
      eventId: "evt_1",
      fbp: "fb.1.1.2",
      fbc: "fb.1.1.IwAR3",
    });
    expect(sendTikTokPurchase).toHaveBeenCalledWith({
      email: "a@b.com",
      value: 29.99,
      currency: "USD",
      eventId: "evt_1",
      ttp: "ttp-abc",
      ttclid: "E.C.P.click123",
    });
  });

  it("still reports to TikTok when Meta throws, and does not reject", async () => {
    vi.mocked(sendCapiPurchase).mockRejectedValueOnce(new Error("meta down"));
    await expect(reportPurchase(input)).resolves.toBeUndefined();
    expect(sendTikTokPurchase).toHaveBeenCalled();
  });

  it("still reports to Meta when TikTok throws, and does not reject", async () => {
    vi.mocked(sendTikTokPurchase).mockRejectedValueOnce(new Error("tiktok down"));
    await expect(reportPurchase(input)).resolves.toBeUndefined();
    expect(sendCapiPurchase).toHaveBeenCalled();
  });
});

describe("reportStartTrial", () => {
  it("reports a trial start to both networks", async () => {
    await reportStartTrial(input);
    expect(sendCapiStartTrial).toHaveBeenCalled();
    expect(sendTikTokStartTrial).toHaveBeenCalled();
  });

  it("does not reject when a network throws", async () => {
    vi.mocked(sendTikTokStartTrial).mockRejectedValueOnce(new Error("tiktok down"));
    await expect(reportStartTrial(input)).resolves.toBeUndefined();
    expect(sendCapiStartTrial).toHaveBeenCalled();
  });
});
