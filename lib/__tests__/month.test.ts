// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolveMonthWindow } from "@/lib/month";

const NOW = new Date("2026-07-18T12:00:00Z");

describe("resolveMonthWindow", () => {
  it("defaults to the current month, ending yesterday", () => {
    const w = resolveMonthWindow(undefined, NOW);
    expect(w.ym).toBe("2026-07");
    expect(w.from).toBe("2026-07-01");
    expect(w.to).toBe("2026-07-17");
    expect(w.isCurrent).toBe(true);
  });

  it("returns full bounds for a past month", () => {
    const w = resolveMonthWindow("2026-06", NOW);
    expect(w.from).toBe("2026-06-01");
    expect(w.to).toBe("2026-06-30");
    expect(w.isCurrent).toBe(false);
  });

  it("handles month lengths correctly", () => {
    expect(resolveMonthWindow("2026-02", NOW).to).toBe("2026-02-28");
    expect(resolveMonthWindow("2026-05", NOW).to).toBe("2026-05-31");
  });

  it("clamps a future month back to the current month", () => {
    const w = resolveMonthWindow("2027-01", NOW);
    expect(w.ym).toBe("2026-07");
  });

  it("rejects malformed input by falling back to current month", () => {
    expect(resolveMonthWindow("garbage", NOW).ym).toBe("2026-07");
    expect(resolveMonthWindow("2026-13", NOW).ym).toBe("2026-07");
  });

  it("on the first of a month, the current window is the single day so far", () => {
    const w = resolveMonthWindow(undefined, new Date("2026-08-01T05:00:00Z"));
    expect(w.ym).toBe("2026-08");
    expect(w.from).toBe("2026-08-01");
    // Yesterday falls in July; clamp "to" to the month start rather than crossing back.
    expect(w.to).toBe("2026-08-01");
  });
});
