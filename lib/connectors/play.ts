import { importPKCS8, SignJWT } from "jose";
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";
import { mrrFromSubs, arrFromMrr } from "@/lib/pricing";
import { resolveMonthWindow, type MonthWindow } from "@/lib/month";

// Google exposes install and subscription statistics ONLY as CSV exports in a
// per-developer Cloud Storage bucket (pubsite_prod_rev_...). The Play
// Developer Reporting API is vitals-only (crashes/ANRs) and has no install or
// subscription metrics; doc-verified 2026-07-18. See
// https://support.google.com/googleplay/android-developer/answer/6135870
const CACHE_KEY = "connector:play";
const SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

interface PlayRaw {
  installs: number;
  paidSubs: number;
}

function hasCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON &&
      process.env.GOOGLE_PLAY_PACKAGE_NAME &&
      process.env.GOOGLE_PLAY_STATS_BUCKET,
  );
}

export function normalize(raw: unknown): Metrics {
  const r = raw as PlayRaw | null;
  const paidSubs = r?.paidSubs ?? 0;
  const mrr = mrrFromSubs(paidSubs);
  return {
    downloads: r?.installs ?? 0,
    paidSubs,
    mrr,
    arr: arrFromMrr(mrr),
  };
}

function serviceAccount(): ServiceAccount {
  const parsed = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON!) as ServiceAccount;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("play service account JSON missing client_email or private_key");
  }
  return parsed;
}

// Exchange a signed service-account JWT for a short-lived OAuth access token.
async function accessToken(sa: ServiceAccount): Promise<string> {
  const pem = sa.private_key.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "RS256");
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`play token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("play token exchange returned no access_token");
  return json.access_token;
}

// Play's exported CSVs are UTF-16LE with a BOM; decode accordingly, falling
// back to UTF-8 when no BOM is present.
export function decodePlayCsv(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function parseCsvLine(line: string): string[] {
  // The stats CSVs are simple comma-separated with no embedded commas in the
  // columns we read; a plain split with quote trimming is sufficient.
  return line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
}

// installs_{pkg}_{YYYYMM}_overview.csv: one row per day. "Daily Device
// Installs" is a flow metric, so summing rows in the window is valid.
export function sumDailyInstalls(csv: string, sinceYmd: string): number {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return 0;
  const header = parseCsvLine(lines[0]);
  const dateIdx = header.findIndex((h) => h === "Date");
  const installsIdx = header.findIndex((h) => h === "Daily Device Installs");
  if (dateIdx < 0 || installsIdx < 0) return 0;

  let total = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if ((cols[dateIdx] ?? "") >= sinceYmd) {
      total += Number(cols[installsIdx]) || 0;
    }
  }
  return total;
}

// subscriptions_{pkg}_{product}_{yyyyMM}_country.csv: rows per day x country.
// "Active Subscriptions" is a stock metric; take the latest date's sum across
// countries, never a sum across days.
export function latestActiveSubscriptions(csv: string): number {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return 0;
  const header = parseCsvLine(lines[0]);
  const dateIdx = header.findIndex((h) => h === "Date");
  const activeIdx = header.findIndex((h) => h === "Active Subscriptions");
  if (dateIdx < 0 || activeIdx < 0) return 0;

  let latestDate = "";
  let total = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const date = cols[dateIdx] ?? "";
    const value = Number(cols[activeIdx]) || 0;
    if (date > latestDate) {
      latestDate = date;
      total = value;
    } else if (date === latestDate) {
      total += value;
    }
  }
  return total;
}

async function fetchGcsObject(token: string, bucket: string, object: string): Promise<ArrayBuffer | null> {
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(object)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`play gcs fetch ${object} failed: ${res.status} ${await res.text()}`);
  }
  return res.arrayBuffer();
}


const PAST_MONTH_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchRaw(window: MonthWindow): Promise<PlayRaw> {
  const sa = serviceAccount();
  const token = await accessToken(sa);
  const bucket = process.env.GOOGLE_PLAY_STATS_BUCKET!.replace(/^gs:\/\//, "").replace(/\/$/, "");
  const pkg = process.env.GOOGLE_PLAY_PACKAGE_NAME!;
  const product = process.env.GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_ID || "video2pdf_pro_annual";
  const ymCompact = window.ym.replace("-", "");

  // Installs: Play's overview CSV is already one file per month.
  const installFile = await fetchGcsObject(
    token,
    bucket,
    `stats/installs/installs_${pkg}_${ymCompact}_overview.csv`,
  );
  const installs = installFile
    ? sumDailyInstalls(decodePlayCsv(installFile), window.from)
    : 0;

  // Active subscribers: the month's subscriptions file; the latest row within
  // it is the snapshot as of month end (or "so far" for the current month).
  // A missing file means no subscription activity that month: honestly 0.
  const subFile = await fetchGcsObject(
    token,
    bucket,
    `financial-stats/subscriptions/subscriptions_${pkg}_${product}_${ymCompact}_country.csv`,
  );
  const paidSubs = subFile ? latestActiveSubscriptions(decodePlayCsv(subFile)) : 0;

  return { installs, paidSubs };
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
    const asOf = window.isCurrent
      ? setCached(cacheKey, data)
      : setCached(cacheKey, data, PAST_MONTH_TTL_MS);
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
