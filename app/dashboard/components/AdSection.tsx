"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chart-theme";

export interface ChannelSpend {
  channel: string;
  spend: number;
  roas: number;
}

export default function AdSection({ data }: { data: ChannelSpend[] }) {
  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="mb-3 text-sm font-semibold text-brand-text">Ad performance</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis dataKey="channel" stroke={CHART_COLORS.axis} fontSize={12} />
          <YAxis stroke={CHART_COLORS.axis} fontSize={12} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f8fafc" }}
          />
          <Bar dataKey="spend" fill={CHART_COLORS.primary} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
