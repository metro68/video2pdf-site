import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => ({
  ok: true,
  json: async () => ({}),
}));
vi.stubGlobal("fetch", fetchMock);
vi.stubEnv("TIKTOK_PIXEL_ID", "TTPIX1");
vi.stubEnv("TIKTOK_EVENTS_ACCESS_TOKEN", "TTTOK1");

import { sendTikTokPurchase, sendTikTokStartTrial } from "@/lib/pixel/tiktok-capi";

// Dynamic fetch init shape from a mocked global; body is a JSON string we parse to assert on.
function bodyOf(call: number = 0): any {
  return JSON.parse((fetchMock.mock.calls[call][1] as any).body);
}

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubEnv("TIKTOK_EVENTS_ACCESS_TOKEN", "TTTOK1");
});

describe("sendTikTokPurchase", () => {
  it("posts CompletePayment to the v1.3 track endpoint with the access token header", async () => {
    await sendTikTokPurchase({ email: "a@b.com", value: 4.99, currency: "USD", eventId: "evt_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://business-api.tiktok.com/open_api/v1.3/event/track/");
    expect((init as any).headers["Access-Token"]).toBe("TTTOK1");
    const body = bodyOf();
    expect(body.event_source).toBe("web");
    expect(body.event_source_id).toBe("TTPIX1");
    expect(body.data[0].event).toBe("CompletePayment");
    expect(body.data[0].event_id).toBe("evt_1");
    expect(body.data[0].properties.value).toBe(4.99);
    expect(body.data[0].properties.currency).toBe("USD");
  });

  it("sends the email SHA-256 hashed, lowercased and trimmed", async () => {
    await sendTikTokPurchase({ email: "  A@B.COM  ", value: 1, currency: "USD", eventId: "evt_2" });
    const expected = createHash("sha256").update("a@b.com").digest("hex");
    expect(bodyOf().data[0].user.email).toBe(expected);
  });

  it("passes ttp/ttclid through unhashed when provided, and omits them when absent", async () => {
    await sendTikTokPurchase({
      email: "a@b.com",
      value: 4.99,
      currency: "USD",
      eventId: "evt_3",
      ttp: "ttp-abc",
      ttclid: "E.C.P.click123",
    });
    expect(bodyOf().data[0].user.ttp).toBe("ttp-abc");
    expect(bodyOf().data[0].user.ttclid).toBe("E.C.P.click123");

    fetchMock.mockClear();
    await sendTikTokPurchase({ email: "a@b.com", value: 4.99, currency: "USD", eventId: "evt_4" });
    expect(bodyOf().data[0].user).not.toHaveProperty("ttp");
    expect(bodyOf().data[0].user).not.toHaveProperty("ttclid");
  });

  it("no-ops when the access token is unset", async () => {
    vi.stubEnv("TIKTOK_EVENTS_ACCESS_TOKEN", "");
    await sendTikTokPurchase({ email: "a@b.com", value: 1, currency: "USD", eventId: "x" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sendTikTokStartTrial", () => {
  it("maps a trial start onto TikTok's Subscribe event", async () => {
    await sendTikTokStartTrial({ email: "a@b.com", value: 29.99, currency: "USD", eventId: "evt_5" });
    const body = bodyOf();
    expect(body.data[0].event).toBe("Subscribe");
    expect(body.data[0].event_id).toBe("evt_5");
    expect(body.data[0].properties.value).toBe(29.99);
  });

  it("no-ops when the access token is unset", async () => {
    vi.stubEnv("TIKTOK_EVENTS_ACCESS_TOKEN", "");
    await sendTikTokStartTrial({ email: "a@b.com", value: 1, currency: "USD", eventId: "x" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
