import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";
import { resolveMonthWindow } from "@/lib/month";
import { hasCredentials } from "@/lib/connectors/posthog";

const CACHE_KEY = "connector:cost";

export interface ScanCost {
  /** Completed scans in the window, the cost-per-scan denominator. */
  scans: number;
  /** Total model spend in USD. Present only once the scan server reports
   * `$ai_generation` cost events; absent means "not measured yet", not "free". */
  modelSpendUsd?: number;
  /** Model spend divided by completed scans, in USD. */
  costPerScanUsd?: number;
}

/**
 * Model spend and cost per scan from PostHog AI observability. Once the scan
 * server emits one `$ai_generation` event per LLM call, PostHog prices each
 * call from the model and token counts into `$ai_total_cost_usd` (no price
 * table needed here); we sum that for spend, count `scan_completed` for volume,
 * and divide for cost per scan.
 */
export function normalizeScanCost(raw: unknown): ScanCost {
  const r = raw as { results?: Array<{ data?: number[] }> } | null;
  const spendSeries = r?.results?.[0]?.data ?? [];
  const scanSeries = r?.results?.[1]?.data ?? [];
  const spend = spendSeries.reduce((a, b) => a + (Number(b) || 0), 0);
  const scans = scanSeries.reduce((a, b) => a + (Number(b) || 0), 0);

  const out: ScanCost = { scans };
  if (spend > 0) {
    out.modelSpendUsd = Math.round(spend * 1e6) / 1e6;
    if (scans > 0) out.costPerScanUsd = spend / scans;
  }
  return out;
}

async function fetchRaw(from: string, to: string): Promise<unknown> {
  const host = process.env.POSTHOG_HOST!.replace(/\/$/, "");
  const projectId = process.env.POSTHOG_PROJECT_ID!;
  const apiKey = process.env.POSTHOG_API_KEY!;

  // Two series over the same daily window, so results[0] is spend and
  // results[1] is scan volume. Spend sums the PostHog-computed cost per
  // generation; scans count completed scans, the unit the $29.99/year price is
  // charged against.
  const body = {
    query: {
      kind: "TrendsQuery",
      series: [
        {
          kind: "EventsNode",
          event: "$ai_generation",
          math: "sum",
          math_property: "$ai_total_cost_usd",
        },
        { kind: "EventsNode", event: "scan_completed", math: "total" },
      ],
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
    throw new Error(`posthog cost fetch failed: ${res.status} ${await res.text()}`);
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
    const data: Metrics = { ...normalizeScanCost(await fetchRaw(window.from, window.to)) };
    const asOf = window.isCurrent
      ? setCached(cacheKey, data)
      : setCached(cacheKey, data, PAST_MONTH_TTL_MS);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
