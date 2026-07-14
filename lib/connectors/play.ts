import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:play";

function hasCredentials(): boolean {
  return Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
}

export function normalize(raw: unknown): Metrics {
  const r = raw as { installs?: number; revenue?: number; paidSubs?: number } | null;
  return {
    downloads: r?.installs ?? 0,
    paidSubs: r?.paidSubs ?? 0,
    mrr: r?.revenue ?? 0,
    arr: r?.revenue ? r.revenue * 12 : 0,
  };
}

async function fetchRaw(): Promise<unknown> {
  throw new Error("play fetch not yet wired");
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
