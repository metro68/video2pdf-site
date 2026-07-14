import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:posthog";

function hasCredentials(): boolean {
  return Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST);
}

export function normalize(raw: unknown): Metrics {
  const r = raw as { result?: Array<{ data?: number[]; count?: number }> } | null;
  const series = r?.result?.[0]?.data ?? [];
  const dau = series.length ? series[series.length - 1] : 0;
  return { dau };
}

async function fetchRaw(): Promise<unknown> {
  throw new Error("posthog fetch not yet wired");
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
