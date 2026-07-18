// @vitest-environment node
import { describe, it, expect } from "vitest";
import { normalize, lastRowValue } from "@/lib/connectors/play";
import { mrrFromSubs } from "@/lib/pricing";

describe("play.lastRowValue", () => {
  it("returns the last row's value, never a sum", () => {
    const raw = {
      rows: [
        { metrics: [{ decimalValue: { value: "3" } }] },
        { metrics: [{ decimalValue: { value: "5" } }] },
        { metrics: [{ decimalValue: { value: "8" } }] },
      ],
    };
    // Must be the last day's value (8), not the sum (16).
    expect(lastRowValue(raw)).toBe(8);
  });

  it("reads integerValue when present", () => {
    const raw = { rows: [{ metrics: [{ integerValue: "42" }] }] };
    expect(lastRowValue(raw)).toBe(42);
  });

  it("returns 0 for no rows", () => {
    expect(lastRowValue({ rows: [] })).toBe(0);
    expect(lastRowValue(null)).toBe(0);
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
