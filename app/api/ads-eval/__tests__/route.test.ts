// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { roleFromRequest, fetchAdInsights, fetchTrialCohort } = vi.hoisted(() => ({
  roleFromRequest: vi.fn(),
  fetchAdInsights: vi.fn(),
  fetchTrialCohort: vi.fn(),
}));
vi.mock("@/lib/session-role", () => ({ roleFromRequest }));
vi.mock("@/lib/connectors/meta", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAdInsights,
}));
vi.mock("@/lib/connectors/stripe", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTrialCohort,
}));

import { GET } from "@/app/api/ads-eval/route";

function req(days = "14") {
  return new Request(`http://localhost/api/ads-eval?days=${days}`);
}

beforeEach(() => {
  roleFromRequest.mockReset();
  fetchAdInsights.mockReset();
  fetchTrialCohort.mockReset();
});

describe("/api/ads-eval auth", () => {
  it("401 for anonymous", async () => {
    roleFromRequest.mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
  });

  it("403 for non-admin", async () => {
    roleFromRequest.mockResolvedValue("marketing");
    expect((await GET(req())).status).toBe(403);
  });
});

describe("/api/ads-eval payload", () => {
  beforeEach(() => {
    roleFromRequest.mockResolvedValue("admin");
    fetchAdInsights.mockResolvedValue({ status: "ok", asOf: "x", data: [] });
    fetchTrialCohort.mockResolvedValue({
      status: "ok", asOf: "x",
      data: { trials: [], aggregates: { trials: 0, decided: 0, payers: 0, canceled: 0, pastDue: 0, pending: 0, collectedUsd: 0 }, dailyTrials: [] },
    });
  });

  it("returns an assembled payload with clamped window", async () => {
    const res = await GET(req("999"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.windowDays).toBe(30);
    expect(body.assumptions.annualPriceUsd).toBeCloseTo(29.99);
    expect(Array.isArray(body.deductions)).toBe(true);
  });

  it("marks partial when a connector errors", async () => {
    fetchAdInsights.mockResolvedValue({ status: "error", asOf: null, data: null, error: "boom" });
    const body = await (await GET(req())).json();
    expect(body.status).toBe("partial");
    expect(body.errors.meta).toBe("boom");
  });
});
