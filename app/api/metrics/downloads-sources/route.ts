import { NextResponse } from "next/server";
import { roleFromRequest } from "@/lib/session-role";
import { fetchInstallSources } from "@/lib/connectors/appsflyer";
import { fetchTrialCohort } from "@/lib/connectors/stripe";
import { fetchTrialEventsDaily } from "@/lib/connectors/posthog";
import { groupSources, dailyInstallSeries } from "@/lib/downloadSources";
import { resolveMonthWindow } from "@/lib/month";

export async function GET(request: Request): Promise<NextResponse> {
  const role = await roleFromRequest(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  const window = resolveMonthWindow(month);
  // Trial charts include today: resolveMonthWindow clamps the current month to
  // yesterday (right for slow store reports), but Stripe and PostHog are live
  // and a same-day trial is exactly what this view exists to surface.
  const today = new Date().toISOString().slice(0, 10);
  const chartTo = window.isCurrent ? today : window.to;

  const [sources, cohort, postTrials] = await Promise.all([
    fetchInstallSources(month),
    fetchTrialCohort(window.from, chartTo),
    fetchTrialEventsDaily(window.from, chartTo),
  ]);

  const rows = sources.data ?? [];
  // Fastest-source policy: app trials come from PostHog's first-party
  // trial_started event (near realtime, includes organic). AppsFlyer's
  // ad-attributed af_start_trial is the fallback when PostHog is down.
  const appTrialsByDate = new Map<string, number>();
  if (postTrials.status === "ok" && postTrials.data) {
    for (const d of postTrials.data) {
      if (d.count > 0) appTrialsByDate.set(d.date, d.count);
    }
  } else {
    for (const r of rows) {
      if (r.trials > 0) appTrialsByDate.set(r.date, (appTrialsByDate.get(r.date) ?? 0) + r.trials);
    }
  }
  const webTrialsByDate = new Map((cohort.data?.dailyTrials ?? []).map((d) => [d.date, d.count]));
  const trialsDaily: Array<{ date: string; web: number; app: number }> = [];
  for (let t = new Date(`${window.from}T00:00:00Z`).getTime(); t <= new Date(`${chartTo}T00:00:00Z`).getTime(); t += 864e5) {
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
          appTrialsSource: postTrials.status === "ok" ? "posthog" : "appsflyer",
        }
      : null,
  });
}
