// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from "vitest";
import { signSession, SESSION_COOKIE } from "@/lib/auth";

const fetchAdReport = vi.fn();
vi.mock("@/lib/connectors/tiktok", () => ({
  fetchAdReport: (...args: unknown[]) => fetchAdReport(...args),
}));

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
});

describe("tiktok-ads route", () => {
  it("rejects requests without a session", async () => {
    const { GET } = await import("@/app/api/metrics/tiktok-ads/route");
    const res = await GET(new Request("http://localhost/api/metrics/tiktok-ads?days=14"));
    expect(res.status).toBe(401);
  });

  it("passes a clamped days window to the connector", async () => {
    fetchAdReport.mockResolvedValue({ status: "ok", asOf: "2026-08-19T00:00:00.000Z", data: { ads: [], currency: "USD" } });
    const { GET } = await import("@/app/api/metrics/tiktok-ads/route");
    const token = await signSession({ email: "x@video2pdf.ai", role: "marketing" });
    const res = await GET(
      new Request("http://localhost/api/metrics/tiktok-ads?days=9999", {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      }),
    );
    expect(res.status).toBe(200);
    expect(fetchAdReport).toHaveBeenCalledWith(90);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.data.currency).toBe("USD");
  });

  it("defaults to 14 days when the param is missing or junk", async () => {
    fetchAdReport.mockResolvedValue({ status: "ok", asOf: null, data: { ads: [], currency: null } });
    const { GET } = await import("@/app/api/metrics/tiktok-ads/route");
    const token = await signSession({ email: "x@video2pdf.ai", role: "admin" });
    await GET(
      new Request("http://localhost/api/metrics/tiktok-ads?days=abc", {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      }),
    );
    expect(fetchAdReport).toHaveBeenCalledWith(14);
  });
});
