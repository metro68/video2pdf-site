import type { SourceDailyRow } from "@/lib/connectors/appsflyer";

export interface SourceSummary {
  /** Raw AppsFlyer media source id, "Organic" for unattributed. */
  source: string;
  /** Human display name for the dashboard. */
  label: string;
  installs: number;
  trials: number;
  campaigns: Array<{ campaign: string; installs: number }>;
}

// AppsFlyer media-source ids seen in this account, mapped to what they mean
// for this product. "my_media_source" is the OneLink default pid, which our
// web funnel's store handoff link and hand-built test links both use.
const SOURCE_LABELS: Array<{ match: (lower: string) => boolean; label: string }> = [
  { match: (s) => s === "organic", label: "Organic" },
  // web_funnel is the pid our /open handoff stamps; my_media_source is the
  // OneLink default that older handoff clicks and hand-built links carry.
  // Same meaning, one label.
  { match: (s) => s === "web_funnel" || s === "my_media_source", label: "Web funnel / OneLink" },
  { match: (s) => s.includes("restricted") || s.includes("facebook") || s.includes("meta"), label: "Meta ads" },
  { match: (s) => s.includes("tiktok"), label: "TikTok ads" },
];

export function sourceLabel(source: string): string {
  const lower = source.toLowerCase();
  const hit = SOURCE_LABELS.find((m) => m.match(lower));
  return hit ? hit.label : source;
}

// Fixed categorical color slot per source label (indexes into
// CHART_COLORS.categorical). Color follows the entity, never its rank: a
// month where one source overtakes another must not repaint either.
const SOURCE_COLOR_SLOTS: Record<string, number> = {
  Organic: 0,
  "Web funnel / OneLink": 1,
  "TikTok ads": 2,
  "Meta ads": 3,
  Other: 4,
};

export function sourceColorSlot(label: string): number {
  return SOURCE_COLOR_SLOTS[label] ?? 4;
}

export interface DailySeriesPoint {
  /** YYYY-MM-DD */
  date: string;
  /** One key per source label, value = installs that day. */
  values: Record<string, number>;
}

export interface DailyInstallSeries {
  /** Source labels in fixed display order, biggest total first, max 4 plus "Other". */
  labels: string[];
  points: DailySeriesPoint[];
}

const MAX_CHART_SOURCES = 4;

/**
 * Shapes per-day attribution rows into a stacked-series structure: one series
 * per source label (merged across platforms), sources beyond the top 4 folded
 * into "Other" so the chart never cycles hues.
 */
export function dailyInstallSeries(rows: SourceDailyRow[], from: string, to: string): DailyInstallSeries {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const label = sourceLabel(r.source);
    totals.set(label, (totals.get(label) ?? 0) + r.installs);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
  const kept = ranked.slice(0, MAX_CHART_SOURCES);
  const labels = ranked.length > MAX_CHART_SOURCES ? [...kept, "Other"] : kept;

  const byDate = new Map<string, Record<string, number>>();
  for (const r of rows) {
    if (r.installs <= 0) continue;
    const label0 = sourceLabel(r.source);
    const label = kept.includes(label0) ? label0 : "Other";
    const rec = byDate.get(r.date) ?? {};
    rec[label] = (rec[label] ?? 0) + r.installs;
    byDate.set(r.date, rec);
  }

  const points: DailySeriesPoint[] = [];
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= new Date(`${to}T00:00:00Z`).getTime(); t += 864e5) {
    const date = new Date(t).toISOString().slice(0, 10);
    points.push({ date, values: byDate.get(date) ?? {} });
  }
  return { labels, points };
}

/** Groups per-day attribution rows into per-source totals, biggest first. */
export function groupSources(rows: SourceDailyRow[]): SourceSummary[] {
  const bySource = new Map<string, SourceSummary>();
  for (const r of rows) {
    const acc = bySource.get(r.source) ?? {
      source: r.source,
      label: sourceLabel(r.source),
      installs: 0,
      trials: 0,
      campaigns: [],
    };
    acc.installs += r.installs;
    acc.trials += r.trials;
    if (r.campaign) {
      const c = acc.campaigns.find((x) => x.campaign === r.campaign);
      if (c) c.installs += r.installs;
      else acc.campaigns.push({ campaign: r.campaign, installs: r.installs });
    }
    bySource.set(r.source, acc);
  }
  return [...bySource.values()].sort((a, b) => b.installs - a.installs);
}
