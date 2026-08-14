"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chart-theme";
import type { AdsEvalPayload } from "@/lib/ads/assemble";
import type { DerivedEconomics } from "@/lib/ads/economics";
import { buildCohortChartSeries } from "@/lib/ads/chart";

export default function CohortChart({
  daily,
  economics,
  gbpPerUsd,
  modeling,
}: {
  daily: AdsEvalPayload["daily"];
  economics: DerivedEconomics;
  gbpPerUsd: number;
  modeling: boolean;
}) {
  const points = buildCohortChartSeries(daily, economics, gbpPerUsd);

  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold text-brand-text">Cumulative spend vs expected revenue</div>
        {modeling ? (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-500">
            MODELING
          </span>
        ) : null}
      </div>
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
        exchange rate, so both lines move only when spend, trials, or assumptions change. The
        expected-revenue curve is shaped by cumulative trial starts day over day, then anchored so
        its final point matches the projected total revenue shown in the P&amp;L tile; it is not
        the same as collected revenue, which is the actual amount Stripe has taken so far for this
        cohort and only appears as a single dot on the final day, after Stripe fees but before any
        later refunds. Refunds that happen after this window closes are not reflected here.
      </p>
    </div>
  );
}
