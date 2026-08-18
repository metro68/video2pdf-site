import { describe, it, expect, vi, beforeEach } from "vitest";

const sqlMock = vi.fn();
vi.mock("@/lib/db/client", () => ({
  sql: (...args: unknown[]) => sqlMock(...args),
}));

import { channelOf, fetchChannelFunnel } from "@/lib/db/channelFunnel";

describe("channelOf", () => {
  it("takes the segment before the first pipe", () => {
    expect(channelOf("tiktok|c:aug-ugc|a:12345")).toBe("tiktok");
    expect(channelOf("meta|c:x|a:y")).toBe("meta");
  });

  it("passes through plain sources", () => {
    expect(channelOf("direct")).toBe("direct");
    expect(channelOf("tiktok_bio")).toBe("tiktok_bio");
  });

  it("maps null or empty to unknown", () => {
    expect(channelOf(null)).toBe("unknown");
    expect(channelOf("")).toBe("unknown");
    expect(channelOf("  ")).toBe("unknown");
  });
});

describe("fetchChannelFunnel", () => {
  beforeEach(() => sqlMock.mockReset());

  it("groups leads and subscriptions by channel, joined by email", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          { src: "tiktok|c:aug|a:123", n: 3 },
          { src: "tiktok_bio", n: 2 },
          { src: null, n: 1 },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { src: "tiktok|c:aug|a:123", trials: 2, paying: 1 },
          { src: null, trials: 1, paying: 0 },
        ],
      });

    const rows = await fetchChannelFunnel("2026-08");

    expect(rows).toEqual([
      {
        channel: "tiktok",
        leads: 3,
        trials: 2,
        paying: 1,
        campaigns: [{ campaign: "aug", leads: 3, trials: 2, paying: 1 }],
      },
      { channel: "tiktok_bio", leads: 2, trials: 0, paying: 0, campaigns: [] },
      { channel: "unknown", leads: 1, trials: 1, paying: 0, campaigns: [] },
    ]);
  });

  it("splits a channel's counts across its campaigns", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          { src: "meta|c:aug-ugc|a:1", n: 4 },
          { src: "meta|c:retarget|a:2", n: 1 },
          { src: "meta", n: 1 },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ src: "meta|c:retarget|a:2", trials: 1, paying: 0 }],
      });

    const rows = await fetchChannelFunnel("2026-08");

    expect(rows).toEqual([
      {
        channel: "meta",
        leads: 6,
        trials: 1,
        paying: 0,
        campaigns: [
          { campaign: "aug-ugc", leads: 4, trials: 0, paying: 0 },
          { campaign: "retarget", leads: 1, trials: 1, paying: 0 },
        ],
      },
    ]);
  });

  it("includes channels that have subscriptions but no leads this month", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ src: "meta|c:x|a:y", trials: 1, paying: 1 }] });

    const rows = await fetchChannelFunnel("2026-08");

    expect(rows).toEqual([
      {
        channel: "meta",
        leads: 0,
        trials: 1,
        paying: 1,
        campaigns: [{ campaign: "x", leads: 0, trials: 1, paying: 1 }],
      },
    ]);
  });

  it("bounds both queries to the calendar month, exclusive of the next", async () => {
    sqlMock.mockResolvedValue({ rows: [] });

    await fetchChannelFunnel("2026-08");

    for (const call of sqlMock.mock.calls) {
      const values = call.slice(1);
      expect(values).toContain("2026-08-01");
      expect(values).toContain("2026-09-01");
    }
  });

  it("rolls the exclusive bound over a year end", async () => {
    // A past December: future months get clamped to the current month by
    // resolveMonthWindow, which would dodge the rollover being tested.
    sqlMock.mockResolvedValue({ rows: [] });

    await fetchChannelFunnel("2025-12");

    const values = sqlMock.mock.calls[0].slice(1);
    expect(values).toContain("2025-12-01");
    expect(values).toContain("2026-01-01");
  });
});
