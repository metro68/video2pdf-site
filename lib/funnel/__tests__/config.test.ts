import { describe, it, expect } from "vitest";
import { FUNNEL_CONFIG, finePrint } from "@/lib/funnel/config";

describe("FUNNEL_CONFIG", () => {
  it("mirrors app pricing exactly", () => {
    expect(FUNNEL_CONFIG.plans.weekly.price).toBe("$4.99");
    expect(FUNNEL_CONFIG.plans.weekly.trialDays).toBe(3);
    expect(FUNNEL_CONFIG.plans.annual.price).toBe("$29.99");
  });
  it("uses the verbatim pro benefits and social proof anchor", () => {
    expect(FUNNEL_CONFIG.proBenefits).toEqual([
      "Full-resolution scans",
      "Searchable, copyable PDFs",
      "Unlimited documents",
    ]);
    expect(FUNNEL_CONFIG.socialProofCount).toBe(12000);
  });
});

describe("finePrint", () => {
  it("includes trial wording when a trial exists", () => {
    expect(finePrint("$4.99", 3)).toBe(
      "3-day free trial if eligible; then $4.99, charged automatically unless canceled 24h before renewal.",
    );
  });
  it("omits trial wording when no trial", () => {
    expect(finePrint("$29.99", 0)).toBe(
      "$29.99 charged automatically unless canceled 24h before renewal.",
    );
  });
});
