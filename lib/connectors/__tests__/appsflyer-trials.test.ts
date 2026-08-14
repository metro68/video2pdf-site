// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { clearCache } from "@/lib/cache";
import { parseTrialEventsCsv, fetchAppTrialEvents } from "@/lib/connectors/appsflyer";

const { getDurableCache, setDurableCache } = vi.hoisted(() => ({
  getDurableCache: vi.fn(),
  setDurableCache: vi.fn(),
}));
vi.mock("@/lib/db/metricCache", () => ({ getDurableCache, setDurableCache }));

beforeEach(() => {
  clearCache();
  getDurableCache.mockReset();
  getDurableCache.mockResolvedValue(null);
  setDurableCache.mockReset();
  setDurableCache.mockResolvedValue(undefined);
  vi.unstubAllGlobals();
  delete process.env.APPSFLYER_API_TOKEN;
  delete process.env.APPSFLYER_IOS_APP_ID;
  delete process.env.APPSFLYER_ANDROID_APP_ID;
});

const CSV = [
  "Date,Agency/PMD (af_prt),Media Source (pid),Campaign (c),Installs,af_start_trial (Unique users),af_start_trial (Event counter),af_start_trial (Sales in GBP)",
  "2026-08-12,None,Organic,None,3,2,2,0.0",
  "2026-08-12,None,restricted,UGC creatives ad,4,3,3,0.0",
  "2026-08-13,None,restricted,UGC creatives ad,2,1,2,0.0",
  "2026-08-13,None,tiktokglobal_int,tt,1,1,1,0.0",
].join("\n");

describe("parseTrialEventsCsv", () => {
  it("sums non-organic af_start_trial unique users per day", () => {
    const rows = parseTrialEventsCsv(CSV);
    expect(rows).toEqual([
      { date: "2026-08-12", trials: 3 },
      { date: "2026-08-13", trials: 2 },
    ]);
  });

  it("returns empty when the trial column is absent or csv is malformed", () => {
    expect(parseTrialEventsCsv("Date,Installs\n2026-08-12,3")).toEqual([]);
    expect(parseTrialEventsCsv("")).toEqual([]);
  });
});

describe("fetchAppTrialEvents", () => {
  it("returns awaiting_credentials without env", async () => {
    const r = await fetchAppTrialEvents();
    expect(r.status).toBe("awaiting_credentials");
    expect(r.data).toBeNull();
  });

  it("serves a fresh durable copy without calling the API", async () => {
    process.env.APPSFLYER_API_TOKEN = "t";
    process.env.APPSFLYER_ANDROID_APP_ID = "com.app";
    const rows = [{ date: "2026-08-14", trials: 2 }];
    getDurableCache.mockResolvedValue({ value: rows, asOf: new Date().toISOString() });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchAppTrialEvents();
    expect(r.status).toBe("ok");
    expect(r.data).toEqual(rows);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to a stale durable copy when the API is rate limited", async () => {
    process.env.APPSFLYER_API_TOKEN = "t";
    process.env.APPSFLYER_ANDROID_APP_ID = "com.app";
    const rows = [{ date: "2026-08-13", trials: 1 }];
    const staleAsOf = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    getDurableCache.mockResolvedValue({ value: rows, asOf: staleAsOf });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, text: async () => "Limit reached" })));
    const r = await fetchAppTrialEvents();
    expect(r.status).toBe("ok");
    expect(r.data).toEqual(rows);
    expect(r.asOf).toBe(staleAsOf);
  });

  it("errors only when the API fails and no durable copy exists", async () => {
    process.env.APPSFLYER_API_TOKEN = "t";
    process.env.APPSFLYER_ANDROID_APP_ID = "com.app";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, text: async () => "Limit reached" })));
    const r = await fetchAppTrialEvents();
    expect(r.status).toBe("error");
    expect(r.error).toContain("403");
  });
});
