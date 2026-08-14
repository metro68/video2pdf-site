"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chart-theme";
import type { AdsEvalPayload } from "@/lib/ads/assemble";
import type { DerivedEconomics } from "@/lib/ads/economics";

export default function CohortChart({
  daily,
  economics,
  gbpPerUsd,
}: {
  daily: AdsEvalPayload["daily"];
  economics: DerivedEconomics;
  gbpPerUsd: number;
}) {
  let cumSpend = 0;
  let cumTrials = 0;
  let lastCollectedUsd = 0;
  for (const d of daily) {
    if (d.collectedUsd > 0) lastCollectedUsd = d.collectedUsd;
  }
  const collectedRevenueGbp = Number((lastCollectedUsd * gbpPerUsd).toFixed(2));
  const points = daily.map((d, i) => {
    cumSpend += d.spendGbp;
    cumTrials += d.stripeTrials;
    const expectedRevenueGbp =
      cumTrials * economics.trialToPaid * economics.netRevenuePerPayerUsd * gbpPerUsd;
    return {
      label: d.date.slice(5),
      spendGbp: Number(cumSpend.toFixed(2)),
      expectedRevenueGbp: Number(expectedRevenueGbp.toFixed(2)),
      collectedRevenueGbp: i === daily.length - 1 ? collectedRevenueGbp : undefined,
    };
  });

  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="mb-3 text-sm font-semibold text-brand-text">Cumulative spend vs expected revenue</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke={CHART_COLORS.axis} fontSize={12} />
          <YAxis stroke={CHART_COLORS.axis} fontSize={12} tickFormatter={(v: number) => `£${v}`} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f8fafc" }}
            formatter={(v: number) => `£${v.toFixed(2)}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="spendGbp"
            name="Cumulative spend (GBP)"
            stroke={CHART_COLORS.series[3]}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="expectedRevenueGbp"
            name="Cumulative expected revenue (GBP)"
            stroke={CHART_COLORS.primaryLight}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="collectedRevenueGbp"
            name="Collected revenue, final day (GBP)"
            stroke={CHART_COLORS.pro}
            strokeWidth={0}
            dot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-3 text-xs leading-snug text-brand-text-secondary">
        GBP per USD is a fixed constant set in assumptions ({gbpPerUsd.toFixed(2)}), not a live
        exchange rate, so both lines move only when spend, trials, or assumptions change. Expected
        revenue is a projection from trial-to-paid and price; it is not the same as collected
        revenue, which is the actual amount Stripe has taken so far for this cohort and only
        appears as a single dot on the final day, after Stripe fees but before any later refunds.
        Refunds that happen after this window closes are not reflected here.
      </p>
    </div>
  );
}
