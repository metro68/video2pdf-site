"use client";

import { useEffect, useState } from "react";
import type { TikTokAdRow, TikTokAdReport } from "@/lib/connectors/tiktok";

interface TikTokAdsResponse {
  status: "ok" | "awaiting_credentials" | "error";
  asOf: string | null;
  data: TikTokAdReport | null;
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", GBP: "£", EUR: "€" };

function money(n: number, currency: string | null): string {
  if (currency && CURRENCY_SYMBOL[currency]) return `${CURRENCY_SYMBOL[currency]}${n.toFixed(2)}`;
  return currency ? `${n.toFixed(2)} ${currency}` : n.toFixed(2);
}

function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

export default function TikTokAdsSection({ days }: { days: number }) {
  const [res, setRes] = useState<TikTokAdsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRes(null);
    fetch(`/api/metrics/tiktok-ads?days=${days}`)
      .then((r) => r.json() as Promise<TikTokAdsResponse>)
      .catch(() => ({ status: "error", asOf: null, data: null }) as TikTokAdsResponse)
      .then((r) => {
        if (!cancelled) setRes(r);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (res?.status === "awaiting_credentials") {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-500">
        TikTok reporting is not connected, so TikTok ad performance cannot be shown.
      </div>
    );
  }

  const currency = res?.data?.currency ?? null;
  const ads: TikTokAdRow[] = res?.data?.ads ?? [];

  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="mb-1 text-sm font-semibold text-brand-text">TikTok ads in this window</div>
      <p className="mb-3 text-xs text-brand-text-secondary">
        From TikTok&apos;s reporting API, same window as above. Conversions are TikTok&apos;s own
        claimed pixel conversions, not Stripe records, so treat them as directional; the funnel by
        channel table on the Overview tab is the first-party check. TikTok spend is not included in
        the Meta economics above.
      </p>
      {res == null ? (
        <p className="text-sm text-brand-text-secondary">Loading&hellip;</p>
      ) : res.status === "error" || !res.data ? (
        <p className="text-sm text-amber-500">TikTok reporting unavailable right now.</p>
      ) : ads.length === 0 ? (
        <p className="text-sm text-brand-text-secondary">No TikTok spend in this window.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-border text-xs text-brand-text-secondary">
                <th className="py-2 pr-3 font-medium">Ad / ad group</th>
                <th className="py-2 pr-3 font-medium">Spend</th>
                <th className="py-2 pr-3 font-medium">CTR</th>
                <th className="py-2 pr-3 font-medium">CPC</th>
                <th className="py-2 pr-3 font-medium">Clicks</th>
                <th className="py-2 pr-3 font-medium">Conversions</th>
                <th className="py-2 pr-3 font-medium">Cost per conv.</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad) => {
                const ctr = ratio(ad.clicks, ad.impressions);
                const cpc = ratio(ad.spend, ad.clicks);
                const cpa = ratio(ad.spend, ad.conversions);
                return (
                  <tr key={ad.adId} className="border-b border-brand-border/50 text-brand-text">
                    <td className="py-2 pr-3">
                      <div>{ad.adName || ad.adId}</div>
                      <div className="text-xs text-brand-text-secondary">
                        {[ad.adgroupName, ad.campaignName].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="py-2 pr-3">{money(ad.spend, currency)}</td>
                    <td className="py-2 pr-3">{ctr != null ? `${(ctr * 100).toFixed(1)}%` : "n/a"}</td>
                    <td className="py-2 pr-3">{cpc != null ? money(cpc, currency) : "n/a"}</td>
                    <td className="py-2 pr-3">{ad.clicks.toLocaleString()}</td>
                    <td className="py-2 pr-3">{ad.conversions.toLocaleString()}</td>
                    <td className="py-2 pr-3">{cpa != null ? money(cpa, currency) : "n/a"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
