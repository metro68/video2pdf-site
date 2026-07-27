import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => ({
  ok: true,
  json: async () => ({}),
}));
vi.stubGlobal("fetch", fetchMock);
vi.stubEnv("META_PIXEL_ID", "PIX1");
vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOK1");

import { sendCapiPurchase, sendCapiStartTrial } from "@/lib/pixel/capi";

beforeEach(() => fetchMock.mockClear());

describe("sendCapiPurchase", () => {
  it("posts a Purchase event with value, currency, event_id, and a hashed-email user_data", async () => {
    await sendCapiPurchase({ email: "a@b.com", value: 4.99, currency: "USD", eventId: "evt_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/PIX1/events");
    // Dynamic fetch init shape from a mocked global; body is a JSON string we parse to assert on.
    const body = JSON.parse((init as any).body);
    expect(body.data[0].event_name).toBe("Purchase");
    expect(body.data[0].event_id).toBe("evt_1");
    expect(body.data[0].custom_data.value).toBe(4.99);
    expect(body.data[0].custom_data.currency).toBe("USD");
    const expectedHash = createHash("sha256").update("a@b.com").digest("hex");
    expect(body.data[0].user_data.em).toBe(expectedHash);
  });

  it("hashes the email lowercased and trimmed before sending", async () => {
    await sendCapiPurchase({ email: "  A@B.COM  ", value: 4.99, currency: "USD", eventId: "evt_2" });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as any).body);
    const expectedHash = createHash("sha256").update("a@b.com").digest("hex");
    expect(body.data[0].user_data.em).toBe(expectedHash);
  });

  it("no-ops when env is unset", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
    await sendCapiPurchase({ email: "a@b.com", value: 1, currency: "USD", eventId: "x" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes fbp/fbc into user_data unhashed when provided, and omits them when absent", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOK1");
    await sendCapiPurchase({
      email: "a@b.com",
      value: 4.99,
      currency: "USD",
      eventId: "evt_3",
      fbp: "fb.1.111.222",
      fbc: "fb.1.111.IwAR333",
    });
    let body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.data[0].user_data.fbp).toBe("fb.1.111.222");
    expect(body.data[0].user_data.fbc).toBe("fb.1.111.IwAR333");

    fetchMock.mockClear();
    await sendCapiPurchase({ email: "a@b.com", value: 4.99, currency: "USD", eventId: "evt_4" });
    body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.data[0].user_data).not.toHaveProperty("fbp");
    expect(body.data[0].user_data).not.toHaveProperty("fbc");
  });
});

describe("sendCapiStartTrial", () => {
  beforeEach(() => vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOK1"));

  it("posts a StartTrial event with value, currency, event_id, and a hashed-email user_data", async () => {
    await sendCapiStartTrial({ email: "a@b.com", value: 29.99, currency: "USD", eventId: "evt_5" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/PIX1/events");
    // Dynamic fetch init shape from a mocked global; body is a JSON string we parse to assert on.
    const body = JSON.parse((init as any).body);
    expect(body.data[0].event_name).toBe("StartTrial");
    expect(body.data[0].event_id).toBe("evt_5");
    expect(body.data[0].custom_data.value).toBe(29.99);
    expect(body.data[0].custom_data.currency).toBe("USD");
    const expectedHash = createHash("sha256").update("a@b.com").digest("hex");
    expect(body.data[0].user_data.em).toBe(expectedHash);
  });

  it("hashes the email lowercased and trimmed before sending", async () => {
    await sendCapiStartTrial({
      email: "  A@B.COM  ",
      value: 29.99,
      currency: "USD",
      eventId: "evt_6",
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as any).body);
    const expectedHash = createHash("sha256").update("a@b.com").digest("hex");
    expect(body.data[0].user_data.em).toBe(expectedHash);
  });

  it("no-ops when env is unset", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
    await sendCapiStartTrial({ email: "a@b.com", value: 1, currency: "USD", eventId: "x" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
