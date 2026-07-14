import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:meta";
const GRAPH_VERSION = "v21.0";

function hasCredentials(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

export function normalize(raw: unknown): Metrics {
  const row = (raw as { data?: Array<Record<string, unknown>> } | null)?.data?.[0];
  const spend = row ? Number(row.spend ?? 0) : 0;
  const roasArr = row?.purchase_roas as Array<{ value?: string }> | undefined;
  const roas = roasArr?.[0]?.value ? Number(roasArr[0].value) : 0;
  const impressions = row ? Number(row.impressions ?? 0) : 0;
  const clicks = row ? Number(row.clicks ?? 0) : 0;
  return { adSpend: spend, roas, impressions, clicks };
}

async function fetchRaw(): Promise<unknown> {
  const token = process.env.META_ACCESS_TOKEN!;
  // Accept an account id with or without the "act_" prefix.
  const rawAccount = process.env.META_AD_ACCOUNT_ID!;
  const account = rawAccount.startsWith("act_") ? rawAccount : `act_${rawAccount}`;

  const params = new URLSearchParams({
    fields: "spend,impressions,clicks,purchase_roas",
    date_preset: "last_7d",
    access_token: token,
  });

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${account}/insights?${params.toString()}`,
  );

  if (!res.ok) {
    throw new Error(`meta fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
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
