import { importPKCS8, SignJWT } from "jose";
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getCached, setCached } from "@/lib/cache";

const CACHE_KEY = "connector:play";
const SCOPE = "https://www.googleapis.com/auth/playdeveloperreporting";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function hasCredentials(): boolean {
  return Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_PLAY_PACKAGE_NAME);
}

export function normalize(raw: unknown): Metrics {
  const r = raw as { installs?: number; revenue?: number; paidSubs?: number } | null;
  return {
    downloads: r?.installs ?? 0,
    paidSubs: r?.paidSubs ?? 0,
    mrr: r?.revenue ?? 0,
    arr: r?.revenue ? r.revenue * 12 : 0,
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

// Sum the aggregated install rows returned by the Play Developer Reporting API.
function sumInstalls(raw: unknown): { installs: number } {
  const rows = (raw as { rows?: Array<{ metrics?: Array<{ decimalValue?: { value?: string } }> }> } | null)?.rows ?? [];
  let installs = 0;
  for (const row of rows) {
    const v = row.metrics?.[0]?.decimalValue?.value;
    if (v != null) installs += Number(v) || 0;
  }
  return { installs };
}

async function fetchRaw(): Promise<unknown> {
  const sa = serviceAccount();
  const token = await accessToken(sa);
  const pkg = process.env.GOOGLE_PLAY_PACKAGE_NAME!;

  const now = new Date();
  const from = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const body = {
    timelineSpec: {
      aggregationPeriod: "DAILY",
      startTime: {
        year: from.getUTCFullYear(),
        month: from.getUTCMonth() + 1,
        day: from.getUTCDate(),
      },
      endTime: {
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
        day: now.getUTCDate(),
      },
    },
    metrics: ["activeDeviceInstalls"],
  };

  const res = await fetch(
    `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${pkg}/installsMetricSet:query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    throw new Error(`play fetch failed: ${res.status} ${await res.text()}`);
  }
  return sumInstalls(await res.json());
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
