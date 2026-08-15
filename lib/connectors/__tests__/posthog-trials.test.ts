// @vitest-environment node
import { describe, it, expect } from "vitest";
import { normalizeTrialEvents } from "@/lib/connectors/posthog";

describe("normalizeTrialEvents", () => {
  it("zips days and counts from a TrendsQuery response", () => {
    const raw = { results: [{ data: [0, 2, 1], days: ["2026-08-13", "2026-08-14", "2026-08-15"] }] };
    expect(normalizeTrialEvents(raw)).toEqual([
      { date: "2026-08-13", count: 0 },
      { date: "2026-08-14", count: 2 },
      { date: "2026-08-15", count: 1 },
    ]);
  });

  it("returns empty on malformed payloads", () => {
    expect(normalizeTrialEvents(null)).toEqual([]);
    expect(normalizeTrialEvents({})).toEqual([]);
    expect(normalizeTrialEvents({ results: [{}] })).toEqual([]);
  });
});
