"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import KpiTile from "./KpiTile";
import AwaitingCard from "./AwaitingCard";
import FreshnessLine from "./FreshnessLine";
import TrendChart from "./TrendChart";
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
  const mrr = (num("appstore", "mrr") ?? 0) + (num("play", "mrr") ?? 0);

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-brand-primary">Analytics</h1>
          <button onClick={onSignOut} className="text-sm text-brand-text-secondary underline">
            Sign out
          </button>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile label="Downloads" value={downloads.toLocaleString()} />
          <KpiTile label="DAU" value={dau != null ? dau.toLocaleString() : "n/a"} />
          <KpiTile label="Paid subscribers" value={(num("appstore", "paidSubs") ?? 0).toLocaleString()} />
          <KpiTile label="Ad spend" value={`$${(num("meta", "adSpend") ?? 0).toLocaleString()}`} />
          {role === "admin" ? <KpiTile label="MRR" value={`$${mrr.toLocaleString()}`} /> : null}
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <TrendChart title="Downloads over time" data={[]} />
          <TrendChart title="DAU over time" data={[]} />
        </section>

        <AdSection
          data={[
            { channel: "Meta", spend: num("meta", "adSpend") ?? 0, roas: num("meta", "roas") ?? 0 },
            { channel: "TikTok", spend: num("tiktok", "adSpend") ?? 0, roas: 0 },
          ]}
        />

        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PROVIDERS.filter((p) => metrics[p]?.status === "awaiting_credentials").map((p) => (
            <AwaitingCard key={p} provider={PROVIDER_LABEL[p]} />
          ))}
        </section>

        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PROVIDERS.map((p) => (
            <FreshnessLine key={p} asOf={metrics[p]?.asOf ?? null} source={PROVIDER_LABEL[p]} />
          ))}
        </section>
      </div>
    </main>
  );
}
