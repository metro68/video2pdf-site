import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

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

function last7DaysRange(): { start: string; end: string } {
  // TikTok expects YYYY-MM-DD. Derive a 7-day window ending today (UTC).
  const dayMs = 24 * 60 * 60 * 1000;
  const end = new Date();
  const start = new Date(end.getTime() - 6 * dayMs);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

async function fetchRaw(): Promise<unknown> {
  const token = process.env.TIKTOK_ACCESS_TOKEN!;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID!;
  const { start, end } = last7DaysRange();

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
