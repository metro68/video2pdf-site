import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:posthog";

function hasCredentials(): boolean {
  return Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST && process.env.POSTHOG_PROJECT_ID);
}

export function normalize(raw: unknown): Metrics {
  const r = raw as { result?: Array<{ data?: number[]; count?: number }> } | null;
  const series = r?.result?.[0]?.data ?? [];
  const dau = series.length ? series[series.length - 1] : 0;
  return { dau };
}

async function fetchRaw(): Promise<unknown> {
  const host = process.env.POSTHOG_HOST!.replace(/\/$/, "");
  const projectId = process.env.POSTHOG_PROJECT_ID!;
  const apiKey = process.env.POSTHOG_API_KEY!;

  // Daily active users over the last 7 days via the Trends insight endpoint.
  const body = {
    events: [{ id: "$pageview", math: "dau" }],
    date_from: "-7d",
    interval: "day",
  };

  const res = await fetch(`${host}/api/projects/${projectId}/insights/trend/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`posthog fetch failed: ${res.status} ${await res.text()}`);
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
