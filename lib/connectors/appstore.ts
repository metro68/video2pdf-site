import { gunzipSync } from "node:zlib";
import { importPKCS8, SignJWT } from "jose";
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";
import { mrrFromSubs, arrFromMrr } from "@/lib/pricing";

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
  paidSubs: number;
}

export function normalize(raw: unknown): Metrics {
  const r = raw as AppStoreRaw | null;
  const paidSubs = r?.paidSubs ?? 0;
  const mrr = mrrFromSubs(paidSubs);
  return {
    downloads: r?.downloads ?? 0,
    paidSubs,
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

// Sales report: count only true first-time app downloads. Apple's SALES SUMMARY
// tags each row with a Product Type Identifier; "1" and "1F" are first installs
// (paid / free app), "1T"/"1E" etc. are updates, "IA*"/"IAY" are in-app purchases
// and subscriptions. We sum Units only for the first-install rows so "downloads"
// is real installs, not installs+IAP+renewals.
const FIRST_INSTALL_TYPES = new Set(["1", "1F", "1T", "F1"]);

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

async function fetchRaw(): Promise<AppStoreRaw> {
  const token = await appStoreToken();
  const vendorNumber = process.env.APPSTORE_VENDOR_NUMBER!;

  // Downloads: daily SALES summary, 2 days back (reports lag ~a day or two).
  const salesTsv = await fetchReport(token, {
    "filter[frequency]": "DAILY",
    "filter[reportType]": "SALES",
    "filter[reportSubType]": "SUMMARY",
    "filter[vendorNumber]": vendorNumber,
    "filter[reportDate]": daysAgo(2),
  });

  // Active subscribers: daily SUBSCRIPTION summary (state snapshot), 2 days back.
  const subTsv = await fetchReport(token, {
    "filter[frequency]": "DAILY",
    "filter[reportType]": "SUBSCRIPTION",
    "filter[reportSubType]": "SUMMARY",
    "filter[vendorNumber]": vendorNumber,
    "filter[version]": "1_4",
    "filter[reportDate]": daysAgo(2),
  });

  return {
    downloads: parseSalesDownloads(salesTsv),
    paidSubs: parseActiveSubscribers(subTsv),
  };
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
