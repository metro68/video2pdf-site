"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import KpiTile from "./KpiTile";
import DashboardTabs from "./DashboardTabs";
import AwaitingCard from "./AwaitingCard";
import FreshnessLine from "./FreshnessLine";

interface MetricResponse {
  status: "ok" | "awaiting_credentials" | "error";
  asOf: string | null;
  data: Record<string, number> | null;
}

const PROVIDERS = ["appstore", "play", "posthog", "appsflyer", "meta", "tiktok", "stripe"] as const;
type Provider = (typeof PROVIDERS)[number];
const PROVIDER_LABEL: Record<Provider, string> = {
  appstore: "App Store",
  play: "Google Play",
  posthog: "PostHog",
  appsflyer: "AppsFlyer",
  meta: "Meta",
  tiktok: "TikTok",
  stripe: "Stripe",
};

// Console links so a viewer can open the source and sanity-check each figure.
const CONSOLE = {
  appstore: { name: "App Store Connect", href: "https://appstoreconnect.apple.com/trends" },
  play: { name: "Play Console", href: "https://play.google.com/console" },
  posthog: { name: "PostHog", href: "https://eu.posthog.com" },
  meta: { name: "Meta Ads", href: "https://business.facebook.com/adsmanager" },
  tiktok: { name: "TikTok Ads", href: "https://ads.tiktok.com" },
  appsflyer: { name: "AppsFlyer", href: "https://hq1.appsflyer.com" },
  stripe: { name: "Stripe Dashboard", href: "https://dashboard.stripe.com/subscriptions" },
} as const;

export default function DashboardClient({ role }: { role: Role }) {
  const router = useRouter();
  const currentYm = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentYm);
  const [metrics, setMetrics] = useState<Record<Provider, MetricResponse | null>>(
    () => Object.fromEntries(PROVIDERS.map((p) => [p, null])) as Record<Provider, MetricResponse | null>,
  );
  const [totalDownloads, setTotalDownloads] = useState<MetricResponse | null>(null);

  // All-time figure: independent of the month picker, so fetched once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/metrics/downloads-total")
      .then((r) => r.json() as Promise<MetricResponse>)
      .catch(() => ({ status: "error", asOf: null, data: null }) as MetricResponse)
      .then((res) => {
        if (!cancelled) setTotalDownloads(res);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMetrics(
      Object.fromEntries(PROVIDERS.map((p) => [p, null])) as Record<Provider, MetricResponse | null>,
    );
    Promise.all(
      PROVIDERS.map((p) =>
        fetch(`/api/metrics/${p}?month=${month}`)
          .then((r) => r.json() as Promise<MetricResponse>)
          .then((res) => [p, res] as const)
          .catch(() => [p, { status: "error", asOf: null, data: null } as MetricResponse] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setMetrics(Object.fromEntries(entries) as Record<Provider, MetricResponse | null>);
    });
    return () => {
      cancelled = true;
    };
  }, [month]);

  async function onSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function num(p: Provider, key: string): number | undefined {
    const d = metrics[p]?.data;
    return d && typeof d[key] === "number" ? d[key] : undefined;
  }

  const isCurrentMonth = month === currentYm;
  const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const downloads = (num("appstore", "downloads") ?? 0) + (num("play", "downloads") ?? 0);
  const dau = num("posthog", "dau");
  // Apple's daily subscription snapshots are only retained ~30 days; for older
  // months the connector reports no subscriber data at all. Show n/a rather
  // than a fake 0 in that case.
  const appstoreSubs = num("appstore", "paidSubs");
  const subsKnown = appstoreSubs !== undefined;
  const mrr =
    (num("appstore", "mrr") ?? 0) + (num("play", "mrr") ?? 0) + (num("stripe", "mrr") ?? 0);
  const webFreeTrials = num("stripe", "webFreeTrials");

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/icon.png"
              alt="Video2PDF"
              className="h-10 w-10 rounded-lg"
            />
            <div>
              <h1 className="text-xl font-bold text-brand-primary">Video2PDF Analytics</h1>
              <p className="text-xs text-brand-text-secondary">
                Each figure links to its source. Store and subscription numbers lag ~1&ndash;2 days; past months refresh daily.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-brand-text-secondary">
              Showing month
              <input
                type="month"
                value={month}
                max={currentYm}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
                className="rounded-lg bg-brand-bg-card border border-brand-border px-3 py-1.5 text-sm text-brand-text"
              />
            </label>
            <button onClick={onSignOut} className="text-sm text-brand-text-secondary underline">
              Sign out
            </button>
          </div>
        </header>

        <DashboardTabs />

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiTile
            label={`New downloads (${monthLabel})`}
            value={downloads.toLocaleString()}
            description={
              isCurrentMonth
                ? `First-time installs in ${monthLabel} so far, App Store + Google Play combined. Excludes updates, re-downloads, and in-app purchases. Lags 1-2 days behind.`
                : `First-time installs in ${monthLabel}, App Store + Google Play combined. Excludes updates, re-downloads, and in-app purchases. A just-ended month can under-report until Apple publishes its monthly report (~5 days into the next month).`
            }
            sources={[CONSOLE.appstore, CONSOLE.play]}
          />
          <KpiTile
            label="Total downloads (all time)"
            value={
              totalDownloads?.status === "ok" &&
              typeof totalDownloads.data?.downloads === "number"
                ? totalDownloads.data.downloads.toLocaleString()
                : "n/a"
            }
            description="Every first-time install since launch (April 2026), App Store + Google Play combined, through the latest reported day. Excludes updates, re-downloads, and in-app purchases. Not affected by the month picker; lags 1-2 days behind."
            sources={[CONSOLE.appstore, CONSOLE.play]}
          />
          <KpiTile
            label="Avg daily active users"
            value={dau != null ? dau.toLocaleString() : "n/a"}
            description={`Average distinct users who did anything in the app per day in ${monthLabel}, from product analytics. Requires PostHog to be receiving events from the app.`}
            sources={[CONSOLE.posthog]}
          />
          <KpiTile
            label="Web free trials"
            value={webFreeTrials != null ? webFreeTrials.toLocaleString() : "n/a"}
            description={`Free trials started on the web funnel via Stripe in ${monthLabel}. Each trial is a Stripe subscription that entered its trial period this month.`}
            sources={[CONSOLE.stripe]}
          />
          {role === "admin" ? (
            <KpiTile
              label="MRR"
              value={subsKnown ? `$${mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "n/a"}
              description={`Monthly recurring revenue: store subscribers x $29.99/12 (US list price; other storefronts price differently, so this is an approximation), plus web subscribers who are past their trial and paying via Stripe, at each plan's actual price normalized to monthly. ${isCurrentMonth ? "Live snapshot." : `As of the end of ${monthLabel}; months older than ~30 days show n/a because Apple no longer retains the daily snapshot, and Stripe only contributes to the live snapshot.`} Cancelled-but-not-lapsed subscribers are included; refunds are not.`}
              sources={[CONSOLE.appstore, CONSOLE.play, CONSOLE.stripe]}
            />
          ) : null}
          {role === "admin" ? (
            <KpiTile
              label="ARR"
              value={subsKnown ? `$${(mrr * 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "n/a"}
              description="Annual recurring revenue = MRR x 12, including web subscriptions that converted to paid via Stripe. A projection of the MRR snapshot, not booked revenue."
              sources={[CONSOLE.appstore, CONSOLE.play, CONSOLE.stripe]}
            />
          ) : null}
        </section>

        {PROVIDERS.some((p) => metrics[p]?.status === "awaiting_credentials") ? (
          <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PROVIDERS.filter((p) => metrics[p]?.status === "awaiting_credentials").map((p) => (
              <AwaitingCard key={p} provider={PROVIDER_LABEL[p]} />
            ))}
          </section>
        ) : null}

        <section>
          <h2 className="text-sm font-semibold text-brand-text">Data sources</h2>
          <p className="mb-3 text-xs text-brand-text-secondary">
            When each source last refreshed. If a source shows an old timestamp or an error, its
            numbers above may be stale or missing.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PROVIDERS.map((p) => (
              <FreshnessLine
                key={p}
                asOf={metrics[p]?.asOf ?? null}
                source={PROVIDER_LABEL[p]}
                status={metrics[p]?.status}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
