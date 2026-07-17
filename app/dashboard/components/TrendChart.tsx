"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chart-theme";

export interface TrendPoint {
  label: string;
  value: number;
}

export default function TrendChart({ title, data }: { title: string; data: TrendPoint[] }) {
  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="mb-3 text-sm font-semibold text-brand-text">{title}</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke={CHART_COLORS.axis} fontSize={12} />
          <YAxis stroke={CHART_COLORS.axis} fontSize={12} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f8fafc" }}
          />
          <Line type="monotone" dataKey="value" stroke={CHART_COLORS.primaryLight} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
