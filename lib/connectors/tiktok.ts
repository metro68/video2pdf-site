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

export interface TikTokAdRow {
  adId: string;
  adName: string;
  adgroupName: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  /** TikTok's claimed conversions for the ad group's optimization event
   * (its own attribution, not Stripe's records). */
  conversions: number;
}

interface AdReportRaw {
  data?: {
    list?: Array<{
      dimensions?: Record<string, unknown>;
      metrics?: Record<string, unknown>;
    }>;
  };
}

export function normalizeAdReport(raw: unknown): TikTokAdRow[] {
  const list = (raw as AdReportRaw | null)?.data?.list;
  if (!Array.isArray(list)) return [];
  return list
    .map((r) => ({
      adId: String(r.dimensions?.ad_id ?? ""),
      adName: String(r.metrics?.ad_name ?? ""),
      adgroupName: String(r.metrics?.adgroup_name ?? ""),
      campaignName: String(r.metrics?.campaign_name ?? ""),
      spend: Number(r.metrics?.spend ?? 0),
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks: Number(r.metrics?.clicks ?? 0),
      conversions: Number(r.metrics?.conversion ?? 0),
    }))
    .sort((a, b) => b.spend - a.spend);
}

async function fetchAdvertiserCurrency(): Promise<string | null> {
  try {
    const ids = encodeURIComponent(JSON.stringify([process.env.TIKTOK_ADVERTISER_ID!]));
    const res = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=${ids}`,
      { headers: { "Access-Token": process.env.TIKTOK_ACCESS_TOKEN! } },
    );
    const json = (await res.json()) as {
      code?: number;
      data?: { list?: Array<{ currency?: string }> };
    };
    if (!res.ok || json.code !== 0) return null;
    return json.data?.list?.[0]?.currency ?? null;
  } catch {
    return null;
  }
}

async function fetchAdReportRaw(days: number): Promise<unknown> {
  const token = process.env.TIKTOK_ACCESS_TOKEN!;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID!;
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 864e5);

  const params = new URLSearchParams({
    advertiser_id: advertiserId,
    report_type: "BASIC",
    data_level: "AUCTION_AD",
    dimensions: JSON.stringify(["ad_id"]),
    metrics: JSON.stringify([
      "ad_name",
      "adgroup_name",
      "campaign_name",
      "spend",
      "impressions",
      "clicks",
      "conversion",
    ]),
    start_date: day(start),
    end_date: day(end),
    page_size: "200",
  });

  const res = await fetch(
    `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${params.toString()}`,
    { headers: { "Access-Token": token } },
  );
  if (!res.ok) {
    throw new Error(`tiktok ad report failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { code?: number; message?: string };
  if (json.code !== undefined && json.code !== 0) {
    throw new Error(`tiktok api error: ${json.code} ${json.message ?? ""}`);
  }
  return json;
}

export interface TikTokAdReport {
  ads: TikTokAdRow[];
  /** The advertiser account's billing currency (spend is reported in it), or
   * null when the info endpoint is unavailable. */
  currency: string | null;
}

// Per-ad performance over a trailing window, for the ads eval tab.
export async function fetchAdReport(days: number): Promise<ConnectorResult<TikTokAdReport>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  const cacheKey = `${CACHE_KEY}:ads:${days}`;
  const cached = getCached<TikTokAdReport>(cacheKey);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const [raw, currency] = await Promise.all([
      fetchAdReportRaw(days),
      fetchAdvertiserCurrency(),
    ]);
    const data: TikTokAdReport = { ads: normalizeAdReport(raw), currency };
    const asOf = setCached(cacheKey, data);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
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
