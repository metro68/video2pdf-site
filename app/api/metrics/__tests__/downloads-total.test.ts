// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from "vitest";
import { signSession, SESSION_COOKIE } from "@/lib/auth";

vi.mock("@/lib/downloads-total", () => ({
  fetchTotalDownloads: vi.fn().mockResolvedValue({
    data: { downloads: 4321 },
    asOf: "2026-08-10T06:00:00.000Z",
    status: "ok",
  }),
}));

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
});

describe("downloads-total route", () => {
  it("rejects requests without a session", async () => {
    const { GET } = await import("@/app/api/metrics/downloads-total/route");
    const res = await GET(new Request("http://localhost/api/metrics/downloads-total"));
    expect(res.status).toBe(401);
  });

  it("returns the cumulative total for a signed-in viewer", async () => {
    const { GET } = await import("@/app/api/metrics/downloads-total/route");
    const token = await signSession({ email: "x@video2pdf.ai", role: "marketing" });
    const res = await GET(
      new Request("http://localhost/api/metrics/downloads-total", {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.data.downloads).toBe(4321);
  });
});
