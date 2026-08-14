import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";
import { resolveMonthWindow } from "@/lib/month";

const CACHE_KEY = "connector:meta";
// Marketing API versions expire ~yearly; v21.0 expired Sep 2025 (expired
// versions silently fall back to the oldest live one). v25.0 is current as of
// 2026-07. Bump when Meta releases new versions.
const GRAPH_VERSION = "v25.0";

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

async function fetchRaw(from: string, to: string): Promise<unknown> {
  const token = process.env.META_ACCESS_TOKEN!;
  // Accept an account id with or without the "act_" prefix.
  const rawAccount = process.env.META_AD_ACCOUNT_ID!;
  const account = rawAccount.startsWith("act_") ? rawAccount : `act_${rawAccount}`;

  const params = new URLSearchParams({
    fields: "spend,impressions,clicks,purchase_roas",
    time_range: JSON.stringify({ since: from, until: to }),
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

export interface AdDailyRow {
  adId: string;
  adName: string;
  adsetName: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  contentViews: number;
  emailStepViews: number;
  leads: number;
  checkouts: number;
  trials: number;
}

// Insights `actions` types vary by account setup, so match by substring.
// Verified live against the ads-eval account on 2026-08-14: Meta reports the
// same underlying conversion under several action_type buckets at once
// (bare "view_content"/"initiate_checkout", "omni_*", "onsite_web_*", and
// "offsite_conversion.fb_pixel_*"). Matching a broad substring like
// "view_content" or "initiate_checkout" double/triple counts if summed. We
// match only the "offsite_conversion.fb_pixel_*" bucket for contentViews/
// leads/checkouts, the single canonical pixel event Meta recommends for
// attribution. No "start_trial" or "funnel_email_step_viewed" action types
// (standard or custom-conversion id) were present in the live sample, so
// those two remain unverified pending those events actually firing;
// substrings are kept as placeholders.
//
// Accumulation is MAX-across-matching-buckets per row, not sum: if Meta ever
// reports a matched event under more than one action_type on the same row
// (as it does for view_content/initiate_checkout above), summing would
// silently double-count it. For the three exact pixel matchers only one
// action_type can match per row today, so max is equivalent to sum; for the
// two still-substring matchers (emailStepViews, trials) max makes us robust
// to the same duplicate-bucket behavior if/when those events start firing
// under multiple buckets.
const ACTION_MATCHERS: Array<{ key: keyof Pick<AdDailyRow, "contentViews" | "emailStepViews" | "leads" | "checkouts" | "trials">; match: string }> = [
  { key: "contentViews", match: "offsite_conversion.fb_pixel_view_content" },
  { key: "emailStepViews", match: "funnel_email_step_viewed" },
  { key: "leads", match: "offsite_conversion.fb_pixel_lead" },
  { key: "checkouts", match: "offsite_conversion.fb_pixel_initiate_checkout" },
  { key: "trials", match: "start_trial" },
];

export function normalizeAdInsights(raw: unknown): AdDailyRow[] {
  const data = (raw as { data?: Array<Record<string, unknown>> } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const out: AdDailyRow = {
      adId: String(row.ad_id ?? ""),
      adName: String(row.ad_name ?? ""),
      adsetName: String(row.adset_name ?? ""),
      date: String(row.date_start ?? ""),
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.inline_link_clicks ?? 0),
      contentViews: 0,
      emailStepViews: 0,
      leads: 0,
      checkouts: 0,
      trials: 0,
    };
    const actions = row.actions as Array<{ action_type?: string; value?: string }> | undefined;
    for (const a of actions ?? []) {
      const type = a.action_type ?? "";
      for (const m of ACTION_MATCHERS) {
        if (type.includes(m.match)) out[m.key] = Math.max(out[m.key], Number(a.value ?? 0));
      }
    }
    return out;
  });
}

const AD_INSIGHTS_CACHE_KEY = "connector:meta:ad-insights";
const AD_INSIGHTS_DAYS = 30;

async function fetchAdInsightsRaw(): Promise<unknown> {
  const token = process.env.META_ACCESS_TOKEN!;
  const rawAccount = process.env.META_AD_ACCOUNT_ID!;
  const account = rawAccount.startsWith("act_") ? rawAccount : `act_${rawAccount}`;
  const until = new Date();
  const since = new Date(until.getTime() - AD_INSIGHTS_DAYS * 864e5);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    level: "ad",
    time_increment: "1",
    fields: "ad_id,ad_name,adset_name,spend,impressions,inline_link_clicks,actions",
    time_range: JSON.stringify({ since: day(since), until: day(until) }),
    limit: "500",
    access_token: token,
  });
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${account}/insights?${params.toString()}`);
  if (!res.ok) throw new Error(`meta ad insights fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function fetchAdInsights(): Promise<ConnectorResult<AdDailyRow[]>> {
  if (!hasCredentials()) return { data: null, asOf: null, status: "awaiting_credentials" };
  const cached = getCached<AdDailyRow[]>(AD_INSIGHTS_CACHE_KEY);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const data = normalizeAdInsights(await fetchAdInsightsRaw());
    const asOf = setCached(AD_INSIGHTS_CACHE_KEY, data);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
