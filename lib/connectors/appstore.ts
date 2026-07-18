import { gunzipSync } from "node:zlib";
import { importPKCS8, SignJWT } from "jose";
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";
import { mrrFromSubs, arrFromMrr } from "@/lib/pricing";
import { resolveMonthWindow, windowDates, type MonthWindow } from "@/lib/month";

const CACHE_KEY = "connector:appstore";

function hasCredentials(): boolean {
  return Boolean(
    process.env.APPSTORE_KEY_ID &&
      process.env.APPSTORE_ISSUER_ID &&
      process.env.APPSTORE_PRIVATE_KEY &&
      process.env.APPSTORE_VENDOR_NUMBER,
  );
}

interface AppStoreRaw {
  downloads: number;
  /** null = subscriber snapshot unavailable (e.g. months beyond Apple's daily
   * report retention); rendered as n/a, never as a fake 0. */
  paidSubs: number | null;
}

export function normalize(raw: unknown): Metrics {
  const r = raw as AppStoreRaw | null;
  const downloads = r?.downloads ?? 0;
  if (r?.paidSubs == null) return { downloads };
  const mrr = mrrFromSubs(r.paidSubs);
  return {
    downloads,
    paidSubs: r.paidSubs,
    mrr,
    arr: arrFromMrr(mrr),
  };
}

// App Store Connect requires an ES256 JWT signed with the .p8 private key.
async function appStoreToken(): Promise<string> {
  const keyId = process.env.APPSTORE_KEY_ID!;
  const issuerId = process.env.APPSTORE_ISSUER_ID!;
  // The private key may arrive with literal "\n" sequences from an env var; restore real newlines.
  const pem = process.env.APPSTORE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(issuerId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .setAudience("appstoreconnect-v1")
    .sign(key);
}

// Sales report: count only true first-time app downloads. Verified against
// Apple's product-type-identifiers reference and our live report data:
// 1 / 1F / 1T are first-time installs (free or paid; 1F is what our universal
// free app produces), 1E* are custom-app variants, 3* are re-downloads, 7* are
// updates, and IA*/IAY are in-app purchases and subscription renewals. Only
// first-install rows count as downloads.
const FIRST_INSTALL_TYPES = new Set(["1", "1F", "1T", "1E", "1EP", "1EU"]);

export function parseSalesDownloads(tsv: string): number {
  const lines = tsv.trim().split(/\r?\n/);
  if (lines.length < 2) return 0;
  const header = lines[0].split("\t").map((h) => h.trim());
  const unitsIdx = header.indexOf("Units");
  const typeIdx = header.indexOf("Product Type Identifier");
  if (unitsIdx < 0) return 0;

  let downloads = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const type = typeIdx >= 0 ? (cols[typeIdx] ?? "").trim() : "";
    // If we can identify the type, only count first installs; if the column is
    // absent, fall back to counting all units (better than nothing).
    if (typeIdx >= 0 && !FIRST_INSTALL_TYPES.has(type)) continue;
    downloads += Number(cols[unitsIdx] ?? 0) || 0;
  }
  return downloads;
}

// Subscription report: sum "Active Standard Price Subscriptions" across all
// subscription SKUs. This is the live count of paying subscribers (cancelled-
// but-not-lapsed still counts; refunds have already dropped off).
export function parseActiveSubscribers(tsv: string): number {
  const lines = tsv.trim().split(/\r?\n/);
  if (lines.length < 2) return 0;
  const header = lines[0].split("\t").map((h) => h.trim());
  const activeIdx = header.indexOf("Active Standard Price Subscriptions");
  if (activeIdx < 0) return 0;

  let subs = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    subs += Number(cols[activeIdx] ?? 0) || 0;
  }
  return subs;
}

function daysAgo(n: number): string {
  const dayMs = 24 * 60 * 60 * 1000;
  return new Date(Date.now() - n * dayMs).toISOString().slice(0, 10);
}

const PAST_MONTH_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchReport(
  token: string,
  params: Record<string, string>,
): Promise<string> {
  const query = new URLSearchParams(params);
  const res = await fetch(
    `https://api.appstoreconnect.apple.com/v1/salesReports?${query.toString()}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/a-gzip" } },
  );
  if (!res.ok) {
    throw new Error(`appstore ${params["filter[reportType]"]} failed: ${res.status} ${await res.text()}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return gunzipSync(buf).toString("utf8");
}

// Daily reports lag about two days behind.
const REPORT_LAG_DAYS = 2;

async function fetchRaw(window: MonthWindow): Promise<AppStoreRaw> {
  const token = await appStoreToken();
  const vendorNumber = process.env.APPSTORE_VENDOR_NUMBER!;

  let downloads: number;
  if (window.isCurrent) {
    // Current month: sum daily reports from the month start up to the report
    // lag. A missing day (Apple 404s dates with no data or not-yet-ready
    // reports) counts as zero rather than failing the whole metric.
    const cutoff = daysAgo(REPORT_LAG_DAYS);
    const dates = windowDates(window).filter((d) => d <= cutoff);
    const dailyTotals = await Promise.all(
      dates.map((date) =>
        fetchReport(token, {
          "filter[frequency]": "DAILY",
          "filter[reportType]": "SALES",
          "filter[reportSubType]": "SUMMARY",
          "filter[vendorNumber]": vendorNumber,
          "filter[reportDate]": date,
        })
          .then(parseSalesDownloads)
          .catch(() => 0),
      ),
    );
    downloads = dailyTotals.reduce((sum, n) => sum + n, 0);
  } else {
    // Past month: Apple publishes a single MONTHLY sales report (~5 days
    // after month end), which also outlives the ~30-day daily retention.
    downloads = await fetchReport(token, {
      "filter[frequency]": "MONTHLY",
      "filter[reportType]": "SALES",
      "filter[reportSubType]": "SUMMARY",
      "filter[vendorNumber]": vendorNumber,
      "filter[reportDate]": window.ym,
    })
      .then(parseSalesDownloads)
      .catch(() => 0);
  }

  // Active subscribers: daily SUBSCRIPTION snapshot. Current month = latest
  // reportable day; past month = the month's last day. Daily reports are only
  // retained ~30 days, so older months resolve to null (shown as n/a).
  const subDate = window.isCurrent
    ? daysAgo(REPORT_LAG_DAYS)
    : window.to;
  const paidSubs = await fetchReport(token, {
    "filter[frequency]": "DAILY",
    "filter[reportType]": "SUBSCRIPTION",
    "filter[reportSubType]": "SUMMARY",
    "filter[vendorNumber]": vendorNumber,
    "filter[version]": "1_4",
    "filter[reportDate]": subDate,
  })
    .then(parseActiveSubscribers)
    .catch(() => null);

  return { downloads, paidSubs };
}

export async function fetchMetrics(month?: string): Promise<ConnectorResult<Metrics>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  const window = resolveMonthWindow(month);
  const cacheKey = `${CACHE_KEY}:${window.ym}`;
  const cached = getCached<Metrics>(cacheKey);
  if (cached) return { data: cached.value, asOf: cached.asOf, status: "ok" };
  try {
    const data = normalize(await fetchRaw(window));
    // Past months are immutable; cache them for a day.
    const asOf = window.isCurrent
      ? setCached(cacheKey, data)
      : setCached(cacheKey, data, PAST_MONTH_TTL_MS);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
