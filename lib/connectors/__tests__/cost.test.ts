// @vitest-environment node
import { describe, it, expect } from "vitest";
import { normalizeScanCost } from "@/lib/connectors/cost";

describe("normalizeScanCost", () => {
  it("sums spend and scans and derives cost per scan", () => {
    const raw = {
      results: [
        { data: [0.5, 1.5, 1.0] }, // $ai_total_cost_usd per day
        { data: [2, 4, 4] }, // scan_completed per day
      ],
    };
    expect(normalizeScanCost(raw)).toEqual({
      scans: 10,
      modelSpendUsd: 3,
      costPerScanUsd: 0.3,
    });
  });

  it("reports scans but no cost when no $ai_generation events landed", () => {
    const raw = { results: [{ data: [0, 0] }, { data: [5, 11] }] };
    // Cost is unknown, not zero, so both cost fields stay absent.
    expect(normalizeScanCost(raw)).toEqual({ scans: 16 });
  });

  it("omits cost per scan when spend exists but no scans completed", () => {
    const raw = { results: [{ data: [0.25] }, { data: [0] }] };
    const out = normalizeScanCost(raw);
    expect(out.scans).toBe(0);
    expect(out.modelSpendUsd).toBe(0.25);
    expect(out.costPerScanUsd).toBeUndefined();
  });

  it("returns zero scans on malformed payloads", () => {
    expect(normalizeScanCost(null)).toEqual({ scans: 0 });
    expect(normalizeScanCost({})).toEqual({ scans: 0 });
    expect(normalizeScanCost({ results: [{}] })).toEqual({ scans: 0 });
  });
});
