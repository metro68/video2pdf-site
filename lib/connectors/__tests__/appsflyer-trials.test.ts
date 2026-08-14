// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { clearCache } from "@/lib/cache";
import { parseTrialEventsCsv, fetchAppTrialEvents } from "@/lib/connectors/appsflyer";

beforeEach(() => {
  clearCache();
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
});
