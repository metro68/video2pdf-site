"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chart-theme";

export interface StackedSeries {
  key: string;
  color: string;
}

/**
 * Stacked per-day bar chart card in the dashboard's house style. Series keys
 * map to fixed colors supplied by the caller so identity never shifts when a
 * month has fewer sources. The 1px surface-colored stroke gives stacked
 * segments a visible seam on the dark background.
 */
export default function StackedDailyChart({
  title,
  note,
  series,
  data,
}: {
  title: string;
  note: string;
  series: StackedSeries[];
  data: Array<Record<string, number | string>>;
}) {
  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="mb-3 text-sm font-semibold text-brand-text">{title}</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} barCategoryGap="25%">
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke={CHART_COLORS.axis} fontSize={12} tickLine={false} />
          <YAxis stroke={CHART_COLORS.axis} fontSize={12} allowDecimals={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "#1e293b", opacity: 0.4 }}
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f8fafc" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="day"
              fill={s.color}
              stroke="#0f172a"
              strokeWidth={1}
              maxBarSize={28}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-3 text-xs leading-snug text-brand-text-secondary">{note}</p>
    </div>
  );
}
