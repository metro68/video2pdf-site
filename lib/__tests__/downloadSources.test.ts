// @vitest-environment node
import { describe, it, expect } from "vitest";
import { groupSources, dailyInstallSeries, sourceLabel, sourceColorSlot } from "@/lib/downloadSources";
import type { SourceDailyRow } from "@/lib/connectors/appsflyer";

function row(overrides: Partial<SourceDailyRow> = {}): SourceDailyRow {
  return { date: "2026-08-14", source: "Organic", campaign: "", installs: 1, trials: 0, ...overrides };
}

describe("sourceLabel", () => {
  it("maps known media sources to display names", () => {
    expect(sourceLabel("Organic")).toBe("Organic");
    expect(sourceLabel("my_media_source")).toBe("Web funnel / OneLink");
    expect(sourceLabel("restricted")).toBe("Meta ads");
    expect(sourceLabel("tiktokglobal_int")).toBe("TikTok ads");
    expect(sourceLabel("someothernetwork_int")).toBe("someothernetwork_int");
  });
});

describe("sourceColorSlot", () => {
  it("gives every known label a stable slot and unknowns the Other slot", () => {
    expect(sourceColorSlot("Organic")).toBe(0);
    expect(sourceColorSlot("Meta ads")).toBe(3);
    expect(sourceColorSlot("mystery")).toBe(4);
  });
});

describe("groupSources", () => {
  it("merges platforms per source, sums installs and trials, biggest first", () => {
    const rows = [
      row({ installs: 2 }),
      row({ installs: 1 }), // second platform, same source
      row({ source: "restricted", campaign: "U.S ad", installs: 5, trials: 1 }),
    ];
    const groups = groupSources(rows);
    expect(groups[0].label).toBe("Meta ads");
    expect(groups[0].installs).toBe(5);
    expect(groups[0].trials).toBe(1);
    expect(groups[0].campaigns).toEqual([{ campaign: "U.S ad", installs: 5 }]);
    expect(groups[1].label).toBe("Organic");
    expect(groups[1].installs).toBe(3);
  });
});

describe("dailyInstallSeries", () => {
  it("builds a point per calendar day with zero-filled gaps", () => {
    const s = dailyInstallSeries([row({ date: "2026-08-14", installs: 2 })], "2026-08-13", "2026-08-15");
    expect(s.points.map((p) => p.date)).toEqual(["2026-08-13", "2026-08-14", "2026-08-15"]);
    expect(s.points[1].values).toEqual({ Organic: 2 });
    expect(s.points[0].values).toEqual({});
  });

  it("folds sources beyond the top four into Other", () => {
    const rows = ["a", "b", "c", "d", "e", "f"].map((src, i) =>
      row({ source: src, installs: 10 - i, date: "2026-08-14" }),
    );
    const s = dailyInstallSeries(rows, "2026-08-14", "2026-08-14");
    expect(s.labels).toHaveLength(5);
    expect(s.labels[4]).toBe("Other");
    // e (6) + f (5) fold into Other
    expect(s.points[0].values.Other).toBe(11);
  });
});
