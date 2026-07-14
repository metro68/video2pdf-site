import { describe, it, expect, beforeEach } from "vitest";
import { getCached, setCached, clearCache } from "@/lib/cache";

describe("cache", () => {
  beforeEach(() => clearCache());

  it("returns null for a missing key", () => {
    expect(getCached("nope")).toBeNull();
  });

  it("stores and retrieves a value with an asOf stamp", () => {
    const asOf = setCached("k", { n: 1 });
    const hit = getCached<{ n: number }>("k");
    expect(hit?.value.n).toBe(1);
    expect(hit?.asOf).toBe(asOf);
    expect(new Date(asOf).toString()).not.toBe("Invalid Date");
  });

  it("expires an entry after its ttl", () => {
    setCached("k", { n: 1 }, 0);
    expect(getCached("k")).toBeNull();
  });
});
