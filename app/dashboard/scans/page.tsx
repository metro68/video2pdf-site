import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import DashboardHeader from "@/app/dashboard/components/DashboardHeader";
import KpiTile from "@/app/dashboard/components/KpiTile";
import {
  fetchScanEconomics,
  type ScanEconomicsRow,
} from "@/lib/connectors/scanEconomics";

// Scan economics: what people actually scan (video length, page count)
// and what each scan costs us in model tokens. Fed by the API server's
// server_scan_processed PostHog event, one row per processed job.

export const dynamic = "force-dynamic";

function fmtDuration(ms: number | null): string {
  if (ms === null) return "-";
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`;
}

function fmtTokens(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

function fmtWhen(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : date.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "completed"
      ? "bg-green-500/10 text-green-600"
      : status === "cancelled"
        ? "bg-gray-500/10 text-brand-text-secondary"
        : "bg-red-500/10 text-red-600";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function ScanRow({ row }: { row: ScanEconomicsRow }) {
  return (
    <tr className="border-t border-brand-border">
      <td className="whitespace-nowrap px-3 py-2">{fmtWhen(row.timestamp)}</td>
      <td className="px-3 py-2">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-3 py-2 text-right">{fmtDuration(row.videoDurationMs)}</td>
      <td className="px-3 py-2 text-right">{row.pageCount ?? "-"}</td>
      <td className="px-3 py-2 text-right">
        {row.flaggedCount ? `${row.flaggedCount} flagged` : "-"}
      </td>
      <td className="px-3 py-2 text-right">{fmtTokens(row.inputTokens)}</td>
      <td className="px-3 py-2 text-right">{fmtTokens(row.outputTokens)}</td>
      <td className="px-3 py-2 text-right">${row.estCostUsd.toFixed(3)}</td>
      <td className="px-3 py-2 text-right">{fmtDuration(row.processingMs)}</td>
    </tr>
  );
}

export default async function ScansPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/login");

  const result = await fetchScanEconomics(30);
  const data = result.data;
  const posthogSource = [
    { name: "PostHog", href: "https://us.posthog.com" },
  ];

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <DashboardHeader subtitle="Scan economics, last 30 days" />

        {result.status === "awaiting_credentials" ? (
          <p className="text-sm text-brand-text-secondary">
            PostHog credentials are not configured for the dashboard.
          </p>
        ) : result.status === "error" || !data ? (
          <p className="text-sm text-red-600">
            Could not load scan economics: {result.error ?? "no data"}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <KpiTile
                label="Scans (30d)"
                value={String(data.summary.scans)}
                description={`${data.summary.completed} completed; the rest failed, were cancelled, or need recapture.`}
                sources={posthogSource}
              />
              <KpiTile
                label="Median video"
                value={
                  data.summary.medianVideoSec !== null
                    ? fmtDuration(data.summary.medianVideoSec * 1000)
                    : "-"
                }
                description="Median recording length across all processed scans."
                sources={posthogSource}
              />
              <KpiTile
                label="Median pages"
                value={
                  data.summary.medianPages !== null
                    ? String(data.summary.medianPages)
                    : "-"
                }
                description="Median page count of completed scans."
                sources={posthogSource}
              />
              <KpiTile
                label="Avg tokens / scan"
                value={
                  data.summary.avgInputTokens !== null
                    ? `${fmtTokens(Math.round(data.summary.avgInputTokens))} in`
                    : "-"
                }
                description={
                  data.summary.avgOutputTokens !== null
                    ? `Plus ${fmtTokens(Math.round(data.summary.avgOutputTokens))} output tokens on average.`
                    : undefined
                }
                sources={posthogSource}
              />
              <KpiTile
                label="Est. cost / scan"
                value={
                  data.summary.avgEstCostUsd !== null
                    ? `$${data.summary.avgEstCostUsd.toFixed(3)}`
                    : "-"
                }
                description="Estimated from token counts at configured per-Mtok rates (SCAN_INPUT_COST_PER_MTOK / SCAN_OUTPUT_COST_PER_MTOK); not a bill."
                sources={posthogSource}
              />
              <KpiTile
                label="Est. spend (30d)"
                value={`$${data.summary.totalEstCostUsd.toFixed(2)}`}
                description="Sum of estimated per-scan costs. Compare against $29.99/year per subscriber."
                sources={posthogSource}
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-brand-text-secondary">
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Video</th>
                    <th className="px-3 py-2 text-right font-medium">Pages</th>
                    <th className="px-3 py-2 text-right font-medium">Quality</th>
                    <th className="px-3 py-2 text-right font-medium">Tokens in</th>
                    <th className="px-3 py-2 text-right font-medium">Tokens out</th>
                    <th className="px-3 py-2 text-right font-medium">Est. cost</th>
                    <th className="px-3 py-2 text-right font-medium">Took</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr className="border-t border-brand-border">
                      <td
                        colSpan={9}
                        className="px-3 py-6 text-center text-brand-text-secondary"
                      >
                        No scans captured yet. Rows appear as the API server
                        processes scans (requires POSTHOG_API_KEY on the API
                        service).
                      </td>
                    </tr>
                  ) : (
                    data.rows.map((row, index) => (
                      <ScanRow key={`${row.timestamp}-${index}`} row={row} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
