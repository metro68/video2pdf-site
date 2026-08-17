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
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) } as never);
  // Reset both, so a multi-pixel test cannot leak its ids into later cases.
  vi.stubEnv("TIKTOK_PIXEL_ID", "TTPIX1");
  vi.stubEnv("TIKTOK_EVENTS_ACCESS_TOKEN", "TTTOK1");
});

describe("sendTikTokPurchase", () => {
  it("posts Purchase to the v1.3 track endpoint with the access token header", async () => {
    await sendTikTokPurchase({ email: "a@b.com", value: 4.99, currency: "USD", eventId: "evt_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://business-api.tiktok.com/open_api/v1.3/event/track/");
    expect((init as any).headers["Access-Token"]).toBe("TTTOK1");
    const body = bodyOf();
    expect(body.event_source).toBe("web");
    expect(body.event_source_id).toBe("TTPIX1");
    expect(body.data[0].event).toBe("Purchase");
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

describe("multiple pixels", () => {
  it("posts the event once per pixel, pairing each id with its own token", async () => {
    vi.stubEnv("TIKTOK_PIXEL_ID", "TTPIX1,TTPIX2");
    vi.stubEnv("TIKTOK_EVENTS_ACCESS_TOKEN", "TOK1,TOK2");
    await sendTikTokPurchase({ email: "a@b.com", value: 4.99, currency: "USD", eventId: "evt_m1" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const sent = fetchMock.mock.calls.map(([, init]) => ({
      pixel: JSON.parse((init as any).body).event_source_id,
      token: (init as any).headers["Access-Token"],
    }));
    expect(sent).toEqual([
      { pixel: "TTPIX1", token: "TOK1" },
      { pixel: "TTPIX2", token: "TOK2" },
    ]);
  });

  it("shares one event_id across pixels so each dedups against its own browser event", async () => {
    vi.stubEnv("TIKTOK_PIXEL_ID", "TTPIX1,TTPIX2");
    vi.stubEnv("TIKTOK_EVENTS_ACCESS_TOKEN", "TOK1,TOK2");
    await sendTikTokPurchase({ email: "a@b.com", value: 4.99, currency: "USD", eventId: "evt_m2" });
    const ids = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as any).body).data[0].event_id);
    expect(ids).toEqual(["evt_m2", "evt_m2"]);
  });

  it("reuses a single token for every pixel when only one is configured", async () => {
    vi.stubEnv("TIKTOK_PIXEL_ID", "TTPIX1,TTPIX2");
    vi.stubEnv("TIKTOK_EVENTS_ACCESS_TOKEN", "SHARED");
    await sendTikTokPurchase({ email: "a@b.com", value: 1, currency: "USD", eventId: "evt_m3" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect((init as any).headers["Access-Token"]).toBe("SHARED");
    }
  });

  it("still reports to the other pixel when one request rejects", async () => {
    vi.stubEnv("TIKTOK_PIXEL_ID", "TTPIX1,TTPIX2");
    vi.stubEnv("TIKTOK_EVENTS_ACCESS_TOKEN", "TOK1,TOK2");
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(
      sendTikTokPurchase({ email: "a@b.com", value: 1, currency: "USD", eventId: "evt_m4" })
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("skips a pixel that has no matching token rather than sending it undefined", async () => {
    vi.stubEnv("TIKTOK_PIXEL_ID", "TTPIX1,TTPIX2,TTPIX3");
    vi.stubEnv("TIKTOK_EVENTS_ACCESS_TOKEN", "TOK1,TOK2");
    await sendTikTokPurchase({ email: "a@b.com", value: 1, currency: "USD", eventId: "evt_m5" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tolerates whitespace around comma-separated values", async () => {
    vi.stubEnv("TIKTOK_PIXEL_ID", " TTPIX1 , TTPIX2 ");
    vi.stubEnv("TIKTOK_EVENTS_ACCESS_TOKEN", " TOK1 , TOK2 ");
    await sendTikTokPurchase({ email: "a@b.com", value: 1, currency: "USD", eventId: "evt_m6" });
    const pixels = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as any).body).event_source_id);
    expect(pixels).toEqual(["TTPIX1", "TTPIX2"]);
  });
});

describe("sendTikTokStartTrial", () => {
  it("posts TikTok's standard StartTrial event", async () => {
    await sendTikTokStartTrial({ email: "a@b.com", value: 29.99, currency: "USD", eventId: "evt_5" });
    const body = bodyOf();
    expect(body.data[0].event).toBe("StartTrial");
    expect(body.data[0].event_id).toBe("evt_5");
    expect(body.data[0].properties.value).toBe(29.99);
  });

  it("no-ops when the access token is unset", async () => {
    vi.stubEnv("TIKTOK_EVENTS_ACCESS_TOKEN", "");
    await sendTikTokStartTrial({ email: "a@b.com", value: 1, currency: "USD", eventId: "x" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
