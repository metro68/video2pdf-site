import { importPKCS8, SignJWT } from "jose";
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";
import { mrrFromSubs, arrFromMrr } from "@/lib/pricing";

const CACHE_KEY = "connector:play";
const SCOPE = "https://www.googleapis.com/auth/playdeveloperreporting";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

interface PlayRaw {
  installs: number;
  paidSubs: number;
}

function hasCredentials(): boolean {
  return Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_PLAY_PACKAGE_NAME);
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

interface MetricRow {
  metrics?: Array<{ decimalValue?: { value?: string }; integerValue?: string }>;
}

function rowValue(row: MetricRow | undefined): number {
  const m = row?.metrics?.[0];
  const v = m?.decimalValue?.value ?? m?.integerValue;
  return v != null ? Number(v) || 0 : 0;
}

// Read the last row of a Reporting API timeline. For a flow metric (new installs)
// this is the most recent complete day; for a snapshot metric (active subs) it is
// the current value. Never sum a snapshot across days.
export function lastRowValue(raw: unknown): number {
  const rows = (raw as { rows?: MetricRow[] } | null)?.rows ?? [];
  if (rows.length === 0) return 0;
  return rowValue(rows[rows.length - 1]);
}

function timelineBody(metrics: string[]) {
  // 8-day window ending yesterday so the last bucket is a complete day.
  const dayMs = 24 * 60 * 60 * 1000;
  const end = new Date(Date.now() - dayMs);
  const start = new Date(end.getTime() - 7 * dayMs);
  const ymd = (d: Date) => ({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  });
  return {
    timelineSpec: {
      aggregationPeriod: "DAILY",
      startTime: ymd(start),
      endTime: ymd(end),
    },
    metrics,
  };
}

async function queryMetricSet(
  token: string,
  pkg: string,
  metricSet: string,
  metrics: string[],
): Promise<unknown> {
  const res = await fetch(
    `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${pkg}/${metricSet}:query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(timelineBody(metrics)),
    },
  );
  if (!res.ok) {
    throw new Error(`play ${metricSet} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function fetchRaw(): Promise<PlayRaw> {
  const sa = serviceAccount();
  const token = await accessToken(sa);
  const pkg = process.env.GOOGLE_PLAY_PACKAGE_NAME!;

  // Downloads: new install events per day (a flow), last complete day.
  const installsData = await queryMetricSet(token, pkg, "installsMetricSet", [
    "newDeviceInstalls",
  ]);

  // Active paid subscribers: current active subscription count (a snapshot).
  const subsData = await queryMetricSet(token, pkg, "subscriptionsMetricSet", [
    "activeSubscriptions",
  ]);

  return {
    installs: lastRowValue(installsData),
    paidSubs: lastRowValue(subsData),
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
