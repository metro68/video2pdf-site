// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import {
  normalize,
  parseSalesDownloads,
  parseActiveSubscribers,
  fetchYearlyDownloads,
} from "@/lib/connectors/appstore";
import { mrrFromSubs } from "@/lib/pricing";
import { clearCache, setCached } from "@/lib/cache";

describe("appstore.parseSalesDownloads", () => {
  it("counts only first-install rows, not IAP or updates", () => {
    const tsv = [
      "Units\tProduct Type Identifier",
      "5\t1", // first install (paid app) — counts
      "3\t1F", // first install (free app) — counts
      "10\tIA1", // in-app purchase — excluded
      "7\t7", // update — excluded
    ].join("\n");
    expect(parseSalesDownloads(tsv)).toBe(8);
  });

  it("returns 0 for an empty report", () => {
    expect(parseSalesDownloads("Units\tProduct Type Identifier")).toBe(0);
  });
});

describe("appstore.parseActiveSubscribers", () => {
  it("sums active standard price subscriptions across SKUs", () => {
    const tsv = [
      "App Name\tActive Standard Price Subscriptions",
      "Video2PDF\t40",
      "Video2PDF\t2",
    ].join("\n");
    expect(parseActiveSubscribers(tsv)).toBe(42);
  });

  it("returns 0 when the column is absent", () => {
    expect(parseActiveSubscribers("App Name\tSomething Else\nx\t5")).toBe(0);
  });
});

describe("appstore.normalize", () => {
  it("derives MRR from active paid subs, not proceeds", () => {
    const m = normalize({ downloads: 12, paidSubs: 100 });
    expect(m.paidSubs).toBe(100);
    expect(m.downloads).toBe(12);
    expect(m.mrr).toBeCloseTo(mrrFromSubs(100), 2);
    expect(m.arr).toBeCloseTo(mrrFromSubs(100) * 12, 2);
  });

  it("omits subscriber-derived fields when the snapshot is unavailable", () => {
    const m = normalize({ downloads: 5, paidSubs: null });
    expect(m.downloads).toBe(5);
    expect(m.paidSubs).toBeUndefined();
    expect(m.mrr).toBeUndefined();
    expect(m.arr).toBeUndefined();
  });

  it("is all zero when there are no subscribers", () => {
    const m = normalize({ downloads: 0, paidSubs: 0 });
    expect(m.mrr).toBe(0);
    expect(m.arr).toBe(0);
  });
});

describe("appstore.fetchYearlyDownloads", () => {
  const ENV_KEYS = [
    "APPSTORE_KEY_ID",
    "APPSTORE_ISSUER_ID",
    "APPSTORE_PRIVATE_KEY",
    "APPSTORE_VENDOR_NUMBER",
  ];

  beforeEach(() => {
    clearCache();
    for (const k of ENV_KEYS) delete process.env[k];
  });

  it("returns awaiting_credentials with no keys", async () => {
    const r = await fetchYearlyDownloads("2026");
    expect(r.status).toBe("awaiting_credentials");
    expect(r.data).toBeNull();
  });

  it("serves a cached year without hitting the network", async () => {
    for (const k of ENV_KEYS) process.env[k] = "x";
    setCached("connector:appstore:year:2026", { downloads: 123 });
    const r = await fetchYearlyDownloads("2026");
    expect(r.status).toBe("ok");
    expect(r.data).toEqual({ downloads: 123 });
  });

  it("reports error, not zero, when the report fetch fails", async () => {
    // Garbage credentials make the JWT signing throw; the caller relies on an
    // error status (never a fake 0) to fall back to monthly reports.
    for (const k of ENV_KEYS) process.env[k] = "x";
    const r = await fetchYearlyDownloads("2026");
    expect(r.status).toBe("error");
    expect(r.data).toBeNull();
  });
});
