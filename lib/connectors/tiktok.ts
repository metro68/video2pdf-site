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

async function fetchRaw(): Promise<unknown> {
  throw new Error("tiktok fetch not yet wired");
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
