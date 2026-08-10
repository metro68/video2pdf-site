import * as appstore from "@/lib/connectors/appstore";
import * as play from "@/lib/connectors/play";
import type { ConnectorResult } from "@/lib/connectors/types";

// First month the app could have store installs (the repo was bootstrapped
// 2026-04); iterating from here always covers the full release history.
export const LAUNCH_YM = "2026-04";

export interface TotalDownloads {
  downloads: number;
}

type PartialResult = ConnectorResult<{ downloads?: number }>;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthsBetween(fromYm: string, toYm: string): string[] {
  const [fy, fm] = fromYm.split("-").map(Number);
  const [ty, tm] = toYm.split("-").map(Number);
  const months: string[] = [];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    months.push(`${y}-${pad(m)}`);
  }
  return months;
}

/**
 * All-time first-install total, App Store + Google Play, from launch through
 * the latest reported day. Sums the per-month connector results (which cache
 * themselves), except that completed years on the App Store side come from the
 * YEARLY sales report: Apple only retains monthly reports for one year, so
 * summing months would silently undercount once the app is older than that.
 * Play's stats bucket keeps monthly CSVs indefinitely, so months are fine there.
 */
export async function fetchTotalDownloads(now = new Date()): Promise<ConnectorResult<TotalDownloads>> {
  const currentYm = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
  const fromYm = LAUNCH_YM <= currentYm ? LAUNCH_YM : currentYm;
  const months = monthsBetween(fromYm, currentYm);
  const currentYear = currentYm.slice(0, 4);

  const playResults = await Promise.all(months.map((ym) => play.fetchMetrics(ym)));

  const appstoreResults: PartialResult[] = [];
  const completedYears = [...new Set(months.map((ym) => ym.slice(0, 4)))].filter(
    (y) => y < currentYear,
  );
  for (const year of completedYears) {
    const yearly = await appstore.fetchYearlyDownloads(year);
    if (yearly.status === "error") {
      // Not published yet (first days of January): monthly reports still cover
      // the whole year at that point.
      const yearMonths = months.filter((ym) => ym.startsWith(`${year}-`));
      appstoreResults.push(...(await Promise.all(yearMonths.map((ym) => appstore.fetchMetrics(ym)))));
    } else {
      appstoreResults.push(yearly);
    }
  }
  const currentYearMonths = months.filter((ym) => ym.startsWith(`${currentYear}-`));
  appstoreResults.push(
    ...(await Promise.all(currentYearMonths.map((ym) => appstore.fetchMetrics(ym)))),
  );

  const all: PartialResult[] = [...appstoreResults, ...playResults];
  if (all.every((r) => r.status === "awaiting_credentials")) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  // Any failed slice means the sum would be silently low; n/a is more honest.
  const failed = all.find((r) => r.status === "error");
  if (failed) {
    return { data: null, asOf: null, status: "error", error: failed.error };
  }

  const downloads = all.reduce(
    (sum, r) => sum + (typeof r.data?.downloads === "number" ? r.data.downloads : 0),
    0,
  );
  // The least-fresh slice bounds how current the whole figure is.
  const asOfs = all.map((r) => r.asOf).filter((a): a is string => a != null);
  const asOf = asOfs.length > 0 ? asOfs.sort()[0] : null;

  return { data: { downloads }, asOf, status: "ok" };
}
