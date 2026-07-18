"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import KpiTile from "./KpiTile";
import AwaitingCard from "./AwaitingCard";
import FreshnessLine from "./FreshnessLine";
import AdSection from "./AdSection";

interface MetricResponse {
  status: "ok" | "awaiting_credentials" | "error";
  asOf: string | null;
  data: Record<string, number> | null;
}

const PROVIDERS = ["appstore", "play", "posthog", "appsflyer", "meta", "tiktok"] as const;
type Provider = (typeof PROVIDERS)[number];
const PROVIDER_LABEL: Record<Provider, string> = {
  appstore: "App Store",
  play: "Google Play",
  posthog: "PostHog",
  appsflyer: "AppsFlyer",
  meta: "Meta",
  tiktok: "TikTok",
};

// Console links so a viewer can open the source and sanity-check each figure.
const CONSOLE = {
  appstore: { name: "App Store Connect", href: "https://appstoreconnect.apple.com/trends" },
  play: { name: "Play Console", href: "https://play.google.com/console" },
  posthog: { name: "PostHog", href: "https://eu.posthog.com" },
  meta: { name: "Meta Ads", href: "https://business.facebook.com/adsmanager" },
  tiktok: { name: "TikTok Ads", href: "https://ads.tiktok.com" },
  appsflyer: { name: "AppsFlyer", href: "https://hq1.appsflyer.com" },
} as const;

export default function DashboardClient({ role }: { role: Role }) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Record<Provider, MetricResponse | null>>(
    () => Object.fromEntries(PROVIDERS.map((p) => [p, null])) as Record<Provider, MetricResponse | null>,
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      PROVIDERS.map((p) =>
        fetch(`/api/metrics/${p}`)
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
  }, []);

  async function onSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function num(p: Provider, key: string): number | undefined {
    const d = metrics[p]?.data;
    return d && typeof d[key] === "number" ? d[key] : undefined;
  }

  const downloads = (num("appstore", "downloads") ?? 0) + (num("play", "downloads") ?? 0);
  const dau = num("posthog", "dau");
  const paidSubs = (num("appstore", "paidSubs") ?? 0) + (num("play", "paidSubs") ?? 0);
  const mrr = (num("appstore", "mrr") ?? 0) + (num("play", "mrr") ?? 0);
  const adSpend =
    (num("meta", "adSpend") ?? 0) +
    (num("tiktok", "adSpend") ?? 0) +
    (num("appsflyer", "adSpend") ?? 0);

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
                Each figure links to its source. Store and subscription numbers lag ~1&ndash;2 days.
              </p>
            </div>
          </div>
          <button onClick={onSignOut} className="text-sm text-brand-text-secondary underline">
            Sign out
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiTile
            label="New downloads"
            value={downloads.toLocaleString()}
            description="First-time installs on the most recent reported day, App Store + Google Play combined. Not total installs; new installs only. Lags 1-2 days."
            sources={[CONSOLE.appstore, CONSOLE.play]}
          />
          <KpiTile
            label="Daily active users"
            value={dau != null ? dau.toLocaleString() : "n/a"}
            description="Distinct users who did anything in the app on the last complete day, from product analytics. Requires PostHog to be receiving events from the app."
            sources={[CONSOLE.posthog]}
          />
          <KpiTile
            label="Paid subscribers"
            value={paidSubs.toLocaleString()}
            description="Active paid subscriptions right now, App Store + Google Play. A user who cancels but has not lapsed still counts; refunds drop off."
            sources={[CONSOLE.appstore, CONSOLE.play]}
          />
          <KpiTile
            label="Ad spend (7 days)"
            value={`$${adSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            description="Total ad spend over the last 7 days across Meta, TikTok, and AppsFlyer-tracked partners. $0 means no spend or no active campaigns."
            sources={[CONSOLE.meta, CONSOLE.tiktok, CONSOLE.appsflyer]}
          />
          {role === "admin" ? (
            <KpiTile
              label="MRR"
              value={`$${mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              description="Monthly recurring revenue = active paid subscribers x $29.99/12. Cancelled-but-not-lapsed subscribers are included; refunds are not."
              sources={[CONSOLE.appstore, CONSOLE.play]}
            />
          ) : null}
          {role === "admin" ? (
            <KpiTile
              label="ARR"
              value={`$${(mrr * 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              description="Annual recurring revenue = MRR x 12. A projection of current MRR, not booked revenue."
              sources={[CONSOLE.appstore, CONSOLE.play]}
            />
          ) : null}
        </section>

        <section>
          <div className="mb-2 text-sm font-semibold text-brand-text">Ad performance by channel</div>
          <p className="mb-3 text-xs text-brand-text-secondary">
            Spend over the last 7 days per channel, from each ad platform&apos;s reporting API. A
            channel with no active campaigns shows $0.
          </p>
          <AdSection
            data={[
              { channel: "Meta", spend: num("meta", "adSpend") ?? 0, roas: num("meta", "roas") ?? 0 },
              { channel: "TikTok", spend: num("tiktok", "adSpend") ?? 0, roas: num("tiktok", "roas") ?? 0 },
            ]}
          />
        </section>

        {PROVIDERS.some((p) => metrics[p]?.status === "awaiting_credentials") ? (
          <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PROVIDERS.filter((p) => metrics[p]?.status === "awaiting_credentials").map((p) => (
              <AwaitingCard key={p} provider={PROVIDER_LABEL[p]} />
            ))}
          </section>
        ) : null}

        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PROVIDERS.map((p) => (
            <FreshnessLine key={p} asOf={metrics[p]?.asOf ?? null} source={PROVIDER_LABEL[p]} />
          ))}
        </section>
      </div>
    </main>
  );
}
