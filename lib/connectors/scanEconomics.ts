// Scan economics: per-scan rows captured by the API server as
// server_scan_processed events (one per processed job, any outcome).
// Granular on purpose: the margin question is answered by the
// distribution of video lengths, page counts, and token spend, not by
// a single average.
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:scan-economics";
const TTL_MS = 5 * 60 * 1000;

// Estimated blended prices per million tokens, overridable without a
// deploy when provider pricing changes. Labeled "estimated" in the UI.
const INPUT_COST_PER_MTOK = Number(process.env.SCAN_INPUT_COST_PER_MTOK ?? 1.25);
const OUTPUT_COST_PER_MTOK = Number(process.env.SCAN_OUTPUT_COST_PER_MTOK ?? 10);

export interface ScanEconomicsRow {
  timestamp: string;
  status: string;
  videoDurationMs: number | null;
  videoBytes: number | null;
  pageCount: number | null;
  flaggedCount: number | null;
  absentCount: number | null;
  inputTokens: number;
  outputTokens: number;
  modelCalls: number;
  models: string;
  processingMs: number | null;
  estCostUsd: number;
}

export interface ScanEconomics {
  rows: ScanEconomicsRow[];
  summary: {
    scans: number;
    completed: number;
    medianVideoSec: number | null;
    medianPages: number | null;
    avgInputTokens: number | null;
    avgOutputTokens: number | null;
    avgEstCostUsd: number | null;
    totalEstCostUsd: number;
  };
}

function hasCredentials(): boolean {
  return Boolean(
    process.env.POSTHOG_API_KEY &&
      process.env.POSTHOG_HOST &&
      process.env.POSTHOG_PROJECT_ID,
  );
}

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function toNumberOrNull(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

export function normalizeScanEconomics(raw: unknown): ScanEconomics {
  const results = (raw as { results?: unknown[][] })?.results ?? [];
  const rows: ScanEconomicsRow[] = results.map((r) => {
    const inputTokens = toNumberOrNull(r[7]) ?? 0;
    const outputTokens = toNumberOrNull(r[8]) ?? 0;
    return {
      timestamp: String(r[0] ?? ""),
      status: String(r[1] ?? "unknown"),
      videoDurationMs: toNumberOrNull(r[2]),
      videoBytes: toNumberOrNull(r[3]),
      pageCount: toNumberOrNull(r[4]),
      flaggedCount: toNumberOrNull(r[5]),
      absentCount: toNumberOrNull(r[6]),
      inputTokens,
      outputTokens,
      modelCalls: toNumberOrNull(r[9]) ?? 0,
      models: String(r[10] ?? ""),
      processingMs: toNumberOrNull(r[11]),
      estCostUsd: estimateCostUsd(inputTokens, outputTokens),
    };
  });

  const completedRows = rows.filter((row) => row.status === "completed");
  const costs = rows.map((row) => row.estCostUsd);
  const summary = {
    scans: rows.length,
    completed: completedRows.length,
    medianVideoSec: median(
      rows
        .map((row) => row.videoDurationMs)
        .filter((v): v is number => v !== null)
        .map((v) => v / 1000),
    ),
    medianPages: median(
      completedRows
        .map((row) => row.pageCount)
        .filter((v): v is number => v !== null),
    ),
    avgInputTokens:
      rows.length > 0
        ? rows.reduce((total, row) => total + row.inputTokens, 0) / rows.length
        : null,
    avgOutputTokens:
      rows.length > 0
        ? rows.reduce((total, row) => total + row.outputTokens, 0) / rows.length
        : null,
    avgEstCostUsd:
      rows.length > 0
        ? costs.reduce((total, c) => total + c, 0) / rows.length
        : null,
    totalEstCostUsd: costs.reduce((total, c) => total + c, 0),
  };
  return { rows, summary };
}

export async function fetchScanEconomics(
  days = 30,
): Promise<ConnectorResult<ScanEconomics>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  const cacheKey = `${CACHE_KEY}:${days}`;
  const cached = getCached<ScanEconomics>(cacheKey);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const host = process.env.POSTHOG_HOST!.replace(/\/$/, "");
    const projectId = process.env.POSTHOG_PROJECT_ID!;
    const apiKey = process.env.POSTHOG_API_KEY!;
    const body = {
      query: {
        kind: "HogQLQuery",
        query: `select timestamp,
            properties.status,
            properties.video_duration_ms,
            properties.video_bytes,
            properties.page_count,
            properties.flagged_count,
            properties.absent_count,
            properties.input_tokens,
            properties.output_tokens,
            properties.model_calls,
            properties.models,
            properties.processing_ms
          from events
          where event = 'server_scan_processed'
            and timestamp > now() - interval ${Math.max(1, Math.min(days, 365))} day
          order by timestamp desc
          limit 500`,
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
      throw new Error(
        `posthog scan economics fetch failed: ${res.status} ${await res.text()}`,
      );
    }
    const data = normalizeScanEconomics(await res.json());
    const asOf = setCached(cacheKey, data, TTL_MS);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
