import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:appstore";

function hasCredentials(): boolean {
  return Boolean(
    process.env.APPSTORE_KEY_ID &&
      process.env.APPSTORE_ISSUER_ID &&
      process.env.APPSTORE_PRIVATE_KEY,
  );
}

export function normalize(raw: unknown): Metrics {
  // App Store Connect Sales/Subscription report rows. Wired when credentials arrive.
  const r = raw as { downloads?: number; proceeds?: number; paidSubs?: number } | null;
  return {
    downloads: r?.downloads ?? 0,
    paidSubs: r?.paidSubs ?? 0,
    mrr: r?.proceeds ?? 0,
    arr: r?.proceeds ? r.proceeds * 12 : 0,
  };
}

async function fetchRaw(): Promise<unknown> {
  // Real App Store Connect API call is wired when credentials are provided.
  throw new Error("appstore fetch not yet wired");
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
