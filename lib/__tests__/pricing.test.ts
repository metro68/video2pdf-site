// @vitest-environment node
import { describe, it, expect } from "vitest";
import { mrrFromSubs, arrFromMrr, MONTHLY_PER_SUB_USD } from "@/lib/pricing";

describe("pricing", () => {
  it("computes MRR as active subs times normalized monthly price", () => {
    // $29.99 / 12 ~= $2.4992 per sub per month.
    expect(mrrFromSubs(100)).toBeCloseTo(100 * MONTHLY_PER_SUB_USD, 2);
  });

  it("returns 0 MRR for 0 subs", () => {
    expect(mrrFromSubs(0)).toBe(0);
  });

  it("annualizes MRR into ARR", () => {
    const mrr = mrrFromSubs(100);
    expect(arrFromMrr(mrr)).toBeCloseTo(mrr * 12, 2);
  });
});
