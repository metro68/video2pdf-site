// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTotalDownloads } from "@/lib/downloads-total";
import * as appstore from "@/lib/connectors/appstore";
import * as play from "@/lib/connectors/play";

vi.mock("@/lib/connectors/appstore", () => ({
  fetchMetrics: vi.fn(),
  fetchYearlyDownloads: vi.fn(),
}));
vi.mock("@/lib/connectors/play", () => ({
  fetchMetrics: vi.fn(),
}));

const appstoreMonthly = vi.mocked(appstore.fetchMetrics);
const appstoreYearly = vi.mocked(appstore.fetchYearlyDownloads);
const playMonthly = vi.mocked(play.fetchMetrics);

// Launch is 2026-04, so an Aug 2026 "now" spans five months, all in the launch year.
const AUG_2026 = new Date("2026-08-10T12:00:00Z");
const MAR_2027 = new Date("2027-03-15T12:00:00Z");

function ok(downloads: number, asOf = "2026-08-10T06:00:00.000Z") {
  return { data: { downloads }, asOf, status: "ok" as const };
}
const AWAITING = { data: null, asOf: null, status: "awaiting_credentials" as const };
const ERRORED = { data: null, asOf: null, status: "error" as const, error: "boom" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchTotalDownloads", () => {
  it("sums both stores across every month since launch", async () => {
    appstoreMonthly.mockResolvedValue(ok(10));
    playMonthly.mockResolvedValue(ok(5));

    const r = await fetchTotalDownloads(AUG_2026);

    expect(r.status).toBe("ok");
    expect(r.data).toEqual({ downloads: 75 });
    const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];
    expect(appstoreMonthly.mock.calls.map((c) => c[0])).toEqual(months);
    expect(playMonthly.mock.calls.map((c) => c[0])).toEqual(months);
    expect(appstoreYearly).not.toHaveBeenCalled();
  });

  it("returns awaiting_credentials only when every source is awaiting", async () => {
    appstoreMonthly.mockResolvedValue(AWAITING);
    playMonthly.mockResolvedValue(AWAITING);

    const r = await fetchTotalDownloads(AUG_2026);

    expect(r.status).toBe("awaiting_credentials");
    expect(r.data).toBeNull();
  });

  it("counts the configured store when the other is awaiting credentials", async () => {
    appstoreMonthly.mockResolvedValue(ok(10));
    playMonthly.mockResolvedValue(AWAITING);

    const r = await fetchTotalDownloads(AUG_2026);

    expect(r.status).toBe("ok");
    expect(r.data).toEqual({ downloads: 50 });
  });

  it("reports error rather than a silently low total when any month fails", async () => {
    appstoreMonthly.mockResolvedValue(ok(10));
    playMonthly.mockResolvedValueOnce(ok(5)).mockResolvedValue(ERRORED);

    const r = await fetchTotalDownloads(AUG_2026);

    expect(r.status).toBe("error");
    expect(r.data).toBeNull();
  });

  it("uses the yearly App Store report for completed years", async () => {
    appstoreYearly.mockResolvedValue(ok(100));
    appstoreMonthly.mockResolvedValue(ok(10));
    playMonthly.mockResolvedValue(ok(5));

    const r = await fetchTotalDownloads(MAR_2027);

    expect(r.status).toBe("ok");
    // Yearly 2026 (100) + appstore Jan-Mar 2027 (3 x 10) + play 2026-04..2027-03 (12 x 5).
    expect(r.data).toEqual({ downloads: 190 });
    expect(appstoreYearly).toHaveBeenCalledTimes(1);
    expect(appstoreYearly).toHaveBeenCalledWith("2026");
    expect(appstoreMonthly.mock.calls.map((c) => c[0])).toEqual(["2027-01", "2027-02", "2027-03"]);
    expect(playMonthly).toHaveBeenCalledTimes(12);
  });

  it("falls back to monthly reports when a yearly report is not available yet", async () => {
    appstoreYearly.mockResolvedValue(ERRORED);
    appstoreMonthly.mockResolvedValue(ok(10));
    playMonthly.mockResolvedValue(ok(5));

    const r = await fetchTotalDownloads(MAR_2027);

    expect(r.status).toBe("ok");
    // Appstore monthly for 2026-04..2026-12 and 2027-01..03 (12 x 10) + play (12 x 5).
    expect(r.data).toEqual({ downloads: 180 });
    expect(appstoreMonthly).toHaveBeenCalledTimes(12);
  });

  it("reports the oldest source timestamp as asOf", async () => {
    appstoreMonthly.mockResolvedValue(ok(10, "2026-08-10T06:00:00.000Z"));
    playMonthly.mockResolvedValue(ok(5, "2026-08-09T06:00:00.000Z"));

    const r = await fetchTotalDownloads(AUG_2026);

    expect(r.asOf).toBe("2026-08-09T06:00:00.000Z");
  });
});
