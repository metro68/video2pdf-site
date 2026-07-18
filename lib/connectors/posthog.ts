import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";
import { resolveMonthWindow } from "@/lib/month";

const CACHE_KEY = "connector:posthog";

function hasCredentials(): boolean {
  return Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST && process.env.POSTHOG_PROJECT_ID);
}

export function normalize(raw: unknown): Metrics {
  const r = raw as { results?: Array<{ data?: number[] }> } | null;
  const series = r?.results?.[0]?.data ?? [];
  // Average daily active users across the month window (complete days only).
  const dau = series.length
    ? Math.round(series.reduce((a, b) => a + b, 0) / series.length)
    : 0;
  return { dau };
}

async function fetchRaw(from: string, to: string): Promise<unknown> {
  const host = process.env.POSTHOG_HOST!.replace(/\/$/, "");
  const projectId = process.env.POSTHOG_PROJECT_ID!;
  const apiKey = process.env.POSTHOG_API_KEY!;

  // Daily active users = distinct users who fired ANY event that day, via the
  // modern /query endpoint (the legacy /insights/trend/ endpoint returns 403
  // "Legacy insight endpoints are not available" — verified live). EventsNode
  // with event: null is the catch-all "All events" series; math: "dau" counts
  // distinct users. The window ends yesterday so the last bucket is a complete
  // day. Response shape (verified live): { results: [{ data: number[], days: [...] }] }.
  const body = {
    query: {
      kind: "TrendsQuery",
      series: [{ kind: "EventsNode", event: null, math: "dau" }],
      dateRange: { date_from: from, date_to: to },
      interval: "day",
    },
  };

  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
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
