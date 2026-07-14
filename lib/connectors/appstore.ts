import { gunzipSync } from "node:zlib";
import { importPKCS8, SignJWT } from "jose";
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:appstore";

function hasCredentials(): boolean {
  return Boolean(
    process.env.APPSTORE_KEY_ID &&
      process.env.APPSTORE_ISSUER_ID &&
      process.env.APPSTORE_PRIVATE_KEY &&
      process.env.APPSTORE_VENDOR_NUMBER,
  );
}

export function normalize(raw: unknown): Metrics {
  const r = raw as { downloads?: number; proceeds?: number; paidSubs?: number } | null;
  return {
    downloads: r?.downloads ?? 0,
    paidSubs: r?.paidSubs ?? 0,
    mrr: r?.proceeds ?? 0,
    arr: r?.proceeds ? r.proceeds * 12 : 0,
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

// Parse an App Store Connect Sales report (TSV) into downloads and proceeds.
function parseSalesTsv(tsv: string): { downloads: number; proceeds: number } {
  const lines = tsv.trim().split(/\r?\n/);
  if (lines.length < 2) return { downloads: 0, proceeds: 0 };
  const header = lines[0].split("\t").map((h) => h.trim());
  const unitsIdx = header.indexOf("Units");
  const proceedsIdx = header.findIndex((h) => h === "Developer Proceeds");

  let downloads = 0;
  let proceeds = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (unitsIdx >= 0) downloads += Number(cols[unitsIdx] ?? 0) || 0;
    if (proceedsIdx >= 0) proceeds += Number(cols[proceedsIdx] ?? 0) || 0;
  }
  return { downloads, proceeds };
}

function reportDate(): string {
  // Sales reports are available a day or two behind; request two days ago (UTC).
  const dayMs = 24 * 60 * 60 * 1000;
  const d = new Date(Date.now() - 2 * dayMs);
  return d.toISOString().slice(0, 10);
}

async function fetchRaw(): Promise<unknown> {
  const token = await appStoreToken();
  const vendorNumber = process.env.APPSTORE_VENDOR_NUMBER!;

  const params = new URLSearchParams({
    "filter[frequency]": "DAILY",
    "filter[reportType]": "SALES",
    "filter[reportSubType]": "SUMMARY",
    "filter[vendorNumber]": vendorNumber,
    "filter[reportDate]": reportDate(),
  });

  const res = await fetch(
    `https://api.appstoreconnect.apple.com/v1/salesReports?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/a-gzip" } },
  );

  if (!res.ok) {
    throw new Error(`appstore fetch failed: ${res.status} ${await res.text()}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const tsv = gunzipSync(buf).toString("utf8");
  return parseSalesTsv(tsv);
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
