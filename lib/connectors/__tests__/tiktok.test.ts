// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { normalize, normalizeAdReport, fetchAdReport } from "@/lib/connectors/tiktok";
import { clearCache, setCached } from "@/lib/cache";

describe("tiktok.normalize", () => {
  it("maps spend, impressions and clicks from the advertiser report", () => {
    const raw = { data: { list: [{ metrics: { spend: "42.5", impressions: "1000", clicks: "30" } }] } };
    const m = normalize(raw);
    expect(m.adSpend).toBeCloseTo(42.5);
    expect(m.impressions).toBe(1000);
    expect(m.clicks).toBe(30);
  });
});

describe("tiktok.normalizeAdReport", () => {
  it("maps ad rows and sorts by spend descending", () => {
    const raw = {
      data: {
        list: [
          {
            dimensions: { ad_id: "111" },
            metrics: {
              ad_name: "vid 1",
              adgroup_name: "US web",
              campaign_name: "aug",
              spend: "5.00",
              impressions: "500",
              clicks: "20",
              conversion: "1",
            },
          },
          {
            dimensions: { ad_id: "222" },
            metrics: {
              ad_name: "vid 2",
              adgroup_name: "US web",
              campaign_name: "aug",
              spend: "12.00",
              impressions: "900",
              clicks: "35",
              conversion: "3",
            },
          },
        ],
      },
    };
    const rows = normalizeAdReport(raw);
    expect(rows.map((r) => r.adId)).toEqual(["222", "111"]);
    expect(rows[0]).toEqual({
      adId: "222",
      adName: "vid 2",
      adgroupName: "US web",
      campaignName: "aug",
      spend: 12,
      impressions: 900,
      clicks: 35,
      conversions: 3,
    });
  });

  it("returns an empty list for a malformed payload", () => {
    expect(normalizeAdReport(null)).toEqual([]);
    expect(normalizeAdReport({ data: {} })).toEqual([]);
  });
});

describe("tiktok.fetchAdReport", () => {
  beforeEach(() => {
    clearCache();
    delete process.env.TIKTOK_ACCESS_TOKEN;
    delete process.env.TIKTOK_ADVERTISER_ID;
  });

  it("returns awaiting_credentials with no keys", async () => {
    const r = await fetchAdReport(14);
    expect(r.status).toBe("awaiting_credentials");
    expect(r.data).toBeNull();
  });

  it("serves a cached window without hitting the network", async () => {
    process.env.TIKTOK_ACCESS_TOKEN = "x";
    process.env.TIKTOK_ADVERTISER_ID = "123";
    const ads = [
      {
        adId: "1",
        adName: "a",
        adgroupName: "g",
        campaignName: "c",
        spend: 1,
        impressions: 10,
        clicks: 2,
        conversions: 0,
      },
    ];
    setCached("connector:tiktok:ads:14", { ads, currency: "USD" });
    const r = await fetchAdReport(14);
    expect(r.status).toBe("ok");
    expect(r.data).toEqual({ ads, currency: "USD" });
  });
});
