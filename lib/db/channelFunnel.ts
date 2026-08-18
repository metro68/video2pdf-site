import { sql } from "./client";
import { resolveMonthWindow } from "@/lib/month";

// First-party channel attribution for the dashboard. The /go funnel writes a
// src string shaped "<channel>|c:<campaign>|a:<ad id>" (or a bare token like
// "direct" / "tiktok_bio") to leads.src. Subscriptions carry no channel of
// their own; every checkout is preceded by a lead upsert on the same email, so
// a subscription's channel is its lead's channel. Last touch wins: a returning
// lead overwrites src with the latest visit's source.

export interface ChannelFunnelRow {
  channel: string;
  /** Emails captured on /go this month. */
  leads: number;
  /** Subscriptions created this month (they start as trials). */
  trials: number;
  /** Of those, currently in status "active", i.e. past trial and paying. */
  paying: number;
}

export function channelOf(src: string | null): string {
  const head = (src ?? "").split("|")[0].trim();
  return head === "" ? "unknown" : head;
}

function monthBounds(month?: string): { from: string; toExclusive: string } {
  const { ym } = resolveMonthWindow(month);
  const [y, m] = ym.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${ym}-01`, toExclusive: `${next}-01` };
}

export async function fetchChannelFunnel(month?: string): Promise<ChannelFunnelRow[]> {
  const { from, toExclusive } = monthBounds(month);

  const leadRows = await sql<{ src: string | null; n: number }>`
    SELECT src, COUNT(*)::int AS n
    FROM leads
    WHERE created_at >= ${from} AND created_at < ${toExclusive}
    GROUP BY src
  `;
  const subRows = await sql<{ src: string | null; trials: number; paying: number }>`
    SELECT l.src AS src,
           COUNT(*)::int AS trials,
           (COUNT(*) FILTER (WHERE s.status = 'active'))::int AS paying
    FROM subscriptions s
    LEFT JOIN leads l ON l.email = s.email
    WHERE s.created_at >= ${from} AND s.created_at < ${toExclusive}
    GROUP BY l.src
  `;

  const byChannel = new Map<string, ChannelFunnelRow>();
  const row = (channel: string): ChannelFunnelRow => {
    let r = byChannel.get(channel);
    if (!r) {
      r = { channel, leads: 0, trials: 0, paying: 0 };
      byChannel.set(channel, r);
    }
    return r;
  };
  for (const r of leadRows.rows) {
    row(channelOf(r.src)).leads += Number(r.n) || 0;
  }
  for (const r of subRows.rows) {
    const target = row(channelOf(r.src));
    target.trials += Number(r.trials) || 0;
    target.paying += Number(r.paying) || 0;
  }

  return [...byChannel.values()].sort((a, b) => b.leads - a.leads);
}
