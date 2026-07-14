import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:appsflyer";

function hasCredentials(): boolean {
  return Boolean(process.env.APPSFLYER_API_TOKEN && process.env.APPSFLYER_APP_ID);
}

export function normalize(raw: unknown): Metrics {
  const r = raw as { installs?: number; cost?: number } | null;
  const installs = r?.installs ?? 0;
  const cost = r?.cost ?? 0;
  return { downloads: installs, adSpend: cost };
}

function last7DaysRange(): { from: string; to: string } {
  const dayMs = 24 * 60 * 60 * 1000;
  const to = new Date();
  const from = new Date(to.getTime() - 6 * dayMs);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
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

async function fetchRaw(): Promise<unknown> {
  const token = process.env.APPSFLYER_API_TOKEN!;
  const appId = process.env.APPSFLYER_APP_ID!;
  const { from, to } = last7DaysRange();

  const params = new URLSearchParams({ from, to });
  const res = await fetch(
    `https://hq1.appsflyer.com/api/agg-data/export/app/${appId}/partners_report/v5?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" } },
  );

  if (!res.ok) {
    throw new Error(`appsflyer fetch failed: ${res.status} ${await res.text()}`);
  }
  const csv = await res.text();
  return parseAggregateCsv(csv);
}

export async function fetchMetrics(): Promise<ConnectorResult<Metrics>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  const cached = getCached<Metrics>(CACHE_KEY);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const data = normalize(await fetchRaw());
    const asOf = setCached(CACHE_KEY, data);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
