import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";
import { resolveMonthWindow } from "@/lib/month";

const CACHE_KEY = "connector:appsflyer";

function appIds(): string[] {
  // One AppsFlyer app per platform. Either may be absent before a platform launches.
  return [process.env.APPSFLYER_IOS_APP_ID, process.env.APPSFLYER_ANDROID_APP_ID].filter(
    (id): id is string => Boolean(id),
  );
}

function hasCredentials(): boolean {
  return Boolean(process.env.APPSFLYER_API_TOKEN) && appIds().length > 0;
}

export function normalize(raw: unknown): Metrics {
  const r = raw as { installs?: number; cost?: number } | null;
  const installs = r?.installs ?? 0;
  const cost = r?.cost ?? 0;
  return { downloads: installs, adSpend: cost };
}


// AppsFlyer aggregate reports come back as CSV. Sum installs and cost across rows.
function parseAggregateCsv(csv: string): { installs: number; cost: number } {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return { installs: 0, cost: 0 };
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const installsIdx = header.findIndex((h) => h === "installs");
  const costIdx = header.findIndex((h) => h === "cost" || h === "total cost");

  let installs = 0;
  let cost = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (installsIdx >= 0) installs += Number(cols[installsIdx] ?? 0) || 0;
    if (costIdx >= 0) cost += Number(cols[costIdx] ?? 0) || 0;
  }
  return { installs, cost };
}

async function fetchApp(appId: string, from: string, to: string): Promise<{ installs: number; cost: number }> {
  const token = process.env.APPSFLYER_API_TOKEN!;
  const params = new URLSearchParams({ from, to });
  const res = await fetch(
    `https://hq1.appsflyer.com/api/agg-data/export/app/${appId}/partners_report/v5?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" } },
  );

  if (!res.ok) {
    throw new Error(`appsflyer fetch failed for ${appId}: ${res.status} ${await res.text()}`);
  }
  return parseAggregateCsv(await res.text());
}

async function fetchRaw(from: string, to: string): Promise<unknown> {
  const results = await Promise.all(appIds().map((id) => fetchApp(id, from, to)));
  return results.reduce(
    (acc, r) => ({ installs: acc.installs + r.installs, cost: acc.cost + r.cost }),
    { installs: 0, cost: 0 },
  );
}

const CURRENT_TTL_MS = 6 * 60 * 60 * 1000;
const PAST_MONTH_TTL_MS = 24 * 60 * 60 * 1000;

export interface AppTrialDay {
  date: string;
  trials: number;
}

export interface SourceDailyRow {
  date: string;
  source: string;
  campaign: string;
  installs: number;
  trials: number;
}

// Full per-day source attribution rows from the partners_by_date aggregate
// CSV, all sources including Organic. Column presence varies: the per-event
// columns only appear when that event occurred in the requested range.
export function parseSourceBreakdownCsv(csv: string): SourceDailyRow[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const dateIdx = header.findIndex((h) => h === "date");
  const sourceIdx = header.findIndex((h) => h.startsWith("media source"));
  const campaignIdx = header.findIndex((h) => h.startsWith("campaign"));
  const installsIdx = header.findIndex((h) => h === "installs");
  const trialIdx = header.findIndex((h) => h.includes("af_start_trial") && h.includes("unique"));
  if (dateIdx < 0 || sourceIdx < 0 || installsIdx < 0) return [];

  const out: SourceDailyRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const date = cols[dateIdx];
    if (!date) continue;
    const installs = Number(cols[installsIdx]) || 0;
    const trials = trialIdx >= 0 ? Number(cols[trialIdx]) || 0 : 0;
    if (installs <= 0 && trials <= 0) continue;
    const rawSource = cols[sourceIdx] ?? "";
    out.push({
      date,
      source: rawSource === "" || rawSource === "None" ? "Organic" : rawSource,
      campaign: cols[campaignIdx] === "None" ? "" : (cols[campaignIdx] ?? ""),
      installs,
      trials,
    });
  }
  return out;
}

// Parses the partners_by_date aggregate CSV into per-day ad-attributed app
// trial starts: af_start_trial unique users summed across non-organic media
// sources. Organic rows are excluded because these counts feed ad economics;
// a trial no ad caused must not lower the measured cost per trial.
export function parseTrialEventsCsv(csv: string): AppTrialDay[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const dateIdx = header.findIndex((h) => h === "date");
  const sourceIdx = header.findIndex((h) => h.startsWith("media source"));
  const trialIdx = header.findIndex((h) => h.includes("af_start_trial") && h.includes("unique"));
  if (dateIdx < 0 || trialIdx < 0) return [];

  const byDate = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (sourceIdx >= 0 && cols[sourceIdx]?.toLowerCase() === "organic") continue;
    const date = cols[dateIdx];
    const trials = Number(cols[trialIdx]) || 0;
    if (!date || trials <= 0) continue;
    byDate.set(date, (byDate.get(date) ?? 0) + trials);
  }
  return [...byDate.entries()]
    .map(([date, trials]) => ({ date, trials }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

const SOURCES_CACHE_PREFIX = "connector:appsflyer:sources";

/**
 * Per-source install and trial attribution for one calendar month, both
 * platforms merged. Same quota-aware layering as fetchAppTrialEvents:
 * memory, then durable-if-fresh, then the API with stale-durable fallback.
 */
export async function fetchInstallSources(month?: string): Promise<ConnectorResult<SourceDailyRow[]>> {
  if (!hasCredentials()) return { data: null, asOf: null, status: "awaiting_credentials" };
  const window = resolveMonthWindow(month);
  const cacheKey = `${SOURCES_CACHE_PREFIX}:${window.ym}`;
  const freshMs = window.isCurrent ? CURRENT_TTL_MS : PAST_MONTH_TTL_MS;
  const cached = getCached<SourceDailyRow[]>(cacheKey);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  const { getDurableCache, setDurableCache } = await import("@/lib/db/metricCache");
  const durable = await getDurableCache<SourceDailyRow[]>(cacheKey);
  if (durable && Date.now() - new Date(durable.asOf).getTime() < freshMs) {
    setCached(cacheKey, durable.value, freshMs);
    return { data: durable.value, asOf: durable.asOf, status: "ok" };
  }
  try {
    const token = process.env.APPSFLYER_API_TOKEN!;
    const perApp = await Promise.all(
      appIds().map(async (appId) => {
        const params = new URLSearchParams({ from: window.from, to: window.to });
        const res = await fetch(
          `https://hq1.appsflyer.com/api/agg-data/export/app/${appId}/partners_by_date_report/v5?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" } },
        );
        if (!res.ok) {
          throw new Error(`appsflyer sources fetch failed for ${appId}: ${res.status} ${await res.text()}`);
        }
        return parseSourceBreakdownCsv(await res.text());
      }),
    );
    const data = perApp.flat();
    const asOf = setCached(cacheKey, data, freshMs);
    await setDurableCache(cacheKey, data);
    return { data, asOf, status: "ok" };
  } catch (e) {
    if (durable) {
      setCached(cacheKey, durable.value, freshMs);
      return { data: durable.value, asOf: durable.asOf, status: "ok" };
    }
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}

const TRIALS_CACHE_KEY = "connector:appsflyer:app-trials";
const APP_TRIALS_DAYS = 30;
const TRIALS_FRESH_MS = 6 * 60 * 60 * 1000;

/**
 * Trailing-30-day ad-attributed app trial starts per day, both platforms.
 *
 * AppsFlyer's aggregate Pull API has a small daily quota per report type, and
 * the in-memory cache dies with every serverless instance, so results are
 * also persisted in Postgres. Read order: memory, then durable-if-fresh, then
 * the API; a failed API call (typically "Limit reached") serves the durable
 * copy at any age rather than erroring, because six-hour-old trial counts
 * beat zeros.
 */
export async function fetchAppTrialEvents(): Promise<ConnectorResult<AppTrialDay[]>> {
  if (!hasCredentials()) return { data: null, asOf: null, status: "awaiting_credentials" };
  const cached = getCached<AppTrialDay[]>(TRIALS_CACHE_KEY);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  const { getDurableCache, setDurableCache } = await import("@/lib/db/metricCache");
  const durable = await getDurableCache<AppTrialDay[]>(TRIALS_CACHE_KEY);
  if (durable && Date.now() - new Date(durable.asOf).getTime() < TRIALS_FRESH_MS) {
    setCached(TRIALS_CACHE_KEY, durable.value, TRIALS_FRESH_MS);
    return { data: durable.value, asOf: durable.asOf, status: "ok" };
  }
  try {
    const token = process.env.APPSFLYER_API_TOKEN!;
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const to = new Date();
    const from = new Date(to.getTime() - APP_TRIALS_DAYS * 864e5);
    const perApp = await Promise.all(
      appIds().map(async (appId) => {
        const params = new URLSearchParams({ from: day(from), to: day(to) });
        const res = await fetch(
          `https://hq1.appsflyer.com/api/agg-data/export/app/${appId}/partners_by_date_report/v5?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" } },
        );
        if (!res.ok) {
          throw new Error(`appsflyer trial events fetch failed for ${appId}: ${res.status} ${await res.text()}`);
        }
        return parseTrialEventsCsv(await res.text());
      }),
    );
    const byDate = new Map<string, number>();
    for (const rows of perApp) {
      for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.trials);
    }
    const data = [...byDate.entries()]
      .map(([date, trials]) => ({ date, trials }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    // Same quota concern as fetchMetrics: long TTL keeps agg-data calls rare.
    const asOf = setCached(TRIALS_CACHE_KEY, data, CURRENT_TTL_MS);
    await setDurableCache(TRIALS_CACHE_KEY, data);
    return { data, asOf, status: "ok" };
  } catch (e) {
    // Quota exhausted or transient failure: any durable copy beats zeros.
    if (durable) {
      setCached(TRIALS_CACHE_KEY, durable.value, TRIALS_FRESH_MS);
      return { data: durable.value, asOf: durable.asOf, status: "ok" };
    }
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}

export async function fetchMetrics(month?: string): Promise<ConnectorResult<Metrics>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  const window = resolveMonthWindow(month);
  const cacheKey = `${CACHE_KEY}:${window.ym}`;
  const cached = getCached<Metrics>(cacheKey);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const data = normalize(await fetchRaw(window.from, window.to));
    // AppsFlyer quota for 3+ day ranges is 24 calls/day per app; long TTLs
    // keep us at a handful of calls/day/app even across month switches.
    const asOf = setCached(cacheKey, data, window.isCurrent ? CURRENT_TTL_MS : PAST_MONTH_TTL_MS);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
