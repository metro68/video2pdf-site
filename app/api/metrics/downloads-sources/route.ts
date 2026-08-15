import { NextResponse } from "next/server";
import { roleFromRequest } from "@/lib/session-role";
import { fetchInstallSources } from "@/lib/connectors/appsflyer";
import { fetchTrialCohort } from "@/lib/connectors/stripe";
import { groupSources, dailyInstallSeries } from "@/lib/downloadSources";
import { resolveMonthWindow } from "@/lib/month";

export async function GET(request: Request): Promise<NextResponse> {
  const role = await roleFromRequest(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  const window = resolveMonthWindow(month);

  const [sources, cohort] = await Promise.all([
    fetchInstallSources(month),
    fetchTrialCohort(window.from, window.to),
  ]);

  const rows = sources.data ?? [];
  const appTrialsByDate = new Map<string, number>();
  for (const r of rows) {
    if (r.trials > 0) appTrialsByDate.set(r.date, (appTrialsByDate.get(r.date) ?? 0) + r.trials);
  }
  const webTrialsByDate = new Map((cohort.data?.dailyTrials ?? []).map((d) => [d.date, d.count]));
  const trialsDaily: Array<{ date: string; web: number; app: number }> = [];
  for (let t = new Date(`${window.from}T00:00:00Z`).getTime(); t <= new Date(`${window.to}T00:00:00Z`).getTime(); t += 864e5) {
    const date = new Date(t).toISOString().slice(0, 10);
    trialsDaily.push({ date, web: webTrialsByDate.get(date) ?? 0, app: appTrialsByDate.get(date) ?? 0 });
  }

  return NextResponse.json({
    status: sources.status,
    asOf: sources.asOf,
    data: sources.data
      ? {
          sources: groupSources(rows),
          installsDaily: dailyInstallSeries(rows, window.from, window.to),
          trialsDaily,
          webTrialsOk: cohort.status === "ok",
        }
      : null,
  });
}
