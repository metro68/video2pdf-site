// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from "vitest";
import { signSession, SESSION_COOKIE } from "@/lib/auth";

const fetchChannelFunnel = vi.fn();
vi.mock("@/lib/db/channelFunnel", () => ({
  fetchChannelFunnel: (...args: unknown[]) => fetchChannelFunnel(...args),
}));

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
});

describe("channels route", () => {
  it("rejects requests without a session", async () => {
    const { GET } = await import("@/app/api/metrics/channels/route");
    const res = await GET(new Request("http://localhost/api/metrics/channels?month=2026-08"));
    expect(res.status).toBe(401);
  });

  it("returns per-channel funnel rows for a signed-in viewer", async () => {
    fetchChannelFunnel.mockResolvedValue([
      { channel: "tiktok", leads: 3, trials: 2, paying: 1 },
    ]);
    const { GET } = await import("@/app/api/metrics/channels/route");
    const token = await signSession({ email: "x@video2pdf.ai", role: "marketing" });
    const res = await GET(
      new Request("http://localhost/api/metrics/channels?month=2026-08", {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.data.channels).toEqual([{ channel: "tiktok", leads: 3, trials: 2, paying: 1 }]);
    expect(fetchChannelFunnel).toHaveBeenCalledWith("2026-08");
  });

  it("reports error status when the database query fails", async () => {
    fetchChannelFunnel.mockRejectedValue(new Error("db down"));
    const { GET } = await import("@/app/api/metrics/channels/route");
    const token = await signSession({ email: "x@video2pdf.ai", role: "admin" });
    const res = await GET(
      new Request("http://localhost/api/metrics/channels?month=2026-08", {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      }),
    );
    const json = await res.json();
    expect(json.status).toBe("error");
    expect(json.data).toBeNull();
  });
});
