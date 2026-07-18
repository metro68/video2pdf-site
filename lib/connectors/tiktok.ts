import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";
import { resolveMonthWindow } from "@/lib/month";

const CACHE_KEY = "connector:tiktok";

function hasCredentials(): boolean {
  return Boolean(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_ADVERTISER_ID);
}

export function normalize(raw: unknown): Metrics {
  const metrics = (raw as { data?: { list?: Array<{ metrics?: Record<string, unknown> }> } } | null)
    ?.data?.list?.[0]?.metrics;
  const spend = metrics ? Number(metrics.spend ?? 0) : 0;
  const impressions = metrics ? Number(metrics.impressions ?? 0) : 0;
  const clicks = metrics ? Number(metrics.clicks ?? 0) : 0;
  return { adSpend: spend, impressions, clicks };
}


async function fetchRaw(start: string, end: string): Promise<unknown> {
  const token = process.env.TIKTOK_ACCESS_TOKEN!;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID!;

  const params = new URLSearchParams({
    advertiser_id: advertiserId,
    report_type: "BASIC",
    data_level: "AUCTION_ADVERTISER",
    dimensions: JSON.stringify(["advertiser_id"]),
    metrics: JSON.stringify(["spend", "impressions", "clicks"]),
    start_date: start,
    end_date: end,
  });

  const res = await fetch(
    `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${params.toString()}`,
    { headers: { "Access-Token": token } },
  );

  if (!res.ok) {
    throw new Error(`tiktok fetch failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { code?: number; message?: string };
  if (json.code !== undefined && json.code !== 0) {
    throw new Error(`tiktok api error: ${json.code} ${json.message ?? ""}`);
  }
  return json;
}

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
    const asOf = window.isCurrent
      ? setCached(cacheKey, data)
      : setCached(cacheKey, data, PAST_MONTH_TTL_MS);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
