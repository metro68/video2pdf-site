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
