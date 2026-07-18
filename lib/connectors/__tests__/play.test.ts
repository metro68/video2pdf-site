// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  normalize,
  decodePlayCsv,
  sumDailyInstalls,
  latestActiveSubscriptions,
} from "@/lib/connectors/play";
import { mrrFromSubs } from "@/lib/pricing";

describe("play.decodePlayCsv", () => {
  it("decodes UTF-16LE with BOM (Play's export encoding)", () => {
    const text = "Date,Daily Device Installs\n2026-07-01,3";
    const utf16 = new Uint8Array(2 + text.length * 2);
    utf16[0] = 0xff;
    utf16[1] = 0xfe;
    for (let i = 0; i < text.length; i++) {
      utf16[2 + i * 2] = text.charCodeAt(i);
    }
    expect(decodePlayCsv(utf16.buffer)).toBe(text);
  });

  it("falls back to UTF-8 without BOM", () => {
    const buf = new TextEncoder().encode("Date,X\n2026-07-01,1").buffer;
    expect(decodePlayCsv(buf)).toContain("2026-07-01");
  });
});

describe("play.sumDailyInstalls", () => {
  const csv = [
    "Date,Package Name,Daily Device Installs,Daily Device Uninstalls",
    "2026-06-10,com.vid2pdf.app,4,1",
    "2026-07-01,com.vid2pdf.app,2,0",
    "2026-07-02,com.vid2pdf.app,5,1",
  ].join("\n");

  it("sums the flow metric only within the window", () => {
    expect(sumDailyInstalls(csv, "2026-07-01")).toBe(7);
  });

  it("returns 0 when columns are missing", () => {
    expect(sumDailyInstalls("Date,Other\n2026-07-01,9", "2026-01-01")).toBe(0);
  });
});

describe("play.latestActiveSubscriptions", () => {
  it("takes the latest date's snapshot summed across countries, never summing days", () => {
    const csv = [
      "Date,Package Name,Country,Active Subscriptions",
      "2026-07-01,com.vid2pdf.app,US,3",
      "2026-07-02,com.vid2pdf.app,US,4",
      "2026-07-02,com.vid2pdf.app,DE,1",
    ].join("\n");
    // Latest date (07-02): 4 + 1 = 5. Not 3+4+1.
    expect(latestActiveSubscriptions(csv)).toBe(5);
  });
});

describe("play.normalize", () => {
  it("derives MRR from active subs and maps installs to downloads", () => {
    const m = normalize({ installs: 7, paidSubs: 20 });
    expect(m.downloads).toBe(7);
    expect(m.paidSubs).toBe(20);
    expect(m.mrr).toBeCloseTo(mrrFromSubs(20), 2);
  });

  it("is zero revenue when there are no subs", () => {
    const m = normalize({ installs: 0, paidSubs: 0 });
    expect(m.mrr).toBe(0);
    expect(m.arr).toBe(0);
  });
});
