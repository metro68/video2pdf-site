import type Stripe from "stripe";
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getStripe } from "@/lib/stripe/client";
import { arrFromMrr } from "@/lib/pricing";
import { resolveMonthWindow, type MonthWindow } from "@/lib/month";

function hasCredentials(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// Stripe's `created`/`trial_start` filters and fields are UNIX seconds, while
// resolveMonthWindow works in YYYY-MM-DD calendar dates. `to` is inclusive
// (the last day of the window), so the window's upper bound is the end of
// that day, not its start.
function windowToUnixSeconds(window: MonthWindow): { gte: number; lte: number } {
  const gte = Math.floor(new Date(`${window.from}T00:00:00.000Z`).getTime() / 1000);
  const lte = Math.floor(new Date(`${window.to}T23:59:59.999Z`).getTime() / 1000);
  return { gte, lte };
}

// How many months one billing interval spans, for normalizing a plan's price
// to a monthly value (the web funnel sells weekly and annual plans).
const MONTHS_PER_INTERVAL: Record<string, number> = {
  day: 12 / 365,
  week: 12 / 52,
  month: 1,
  year: 12,
};

function monthlyUsd(sub: Stripe.Subscription): number {
  let cents = 0;
  for (const item of sub.items.data) {
    const price = item.price;
    if (!price?.recurring || price.unit_amount == null) continue;
    const perInterval = MONTHS_PER_INTERVAL[price.recurring.interval];
    if (!perInterval) continue;
    const monthsSpanned = perInterval * (price.recurring.interval_count || 1);
    cents += (price.unit_amount * (item.quantity ?? 1)) / monthsSpanned;
  }
  return cents / 100;
}

// All currently-paying web subscribers, regardless of when they subscribed.
// Stripe keeps a trial in status "trialing" and flips it to "active" only once
// it converts to paid, so listing status "active" yields exactly the paying
// base: trial converts plus plans sold without a trial. A subscriber who
// cancelled but is still inside the paid period stays "active", matching the
// MRR definition in lib/pricing.
async function fetchPayingSubs(): Promise<{ webPaidSubs: number; mrr: number }> {
  let webPaidSubs = 0;
  let mrrUsd = 0;
  let startingAfter: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const page: Stripe.ApiList<Stripe.Subscription> = await getStripe().subscriptions.list({
      status: "active",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const sub of page.data) {
      webPaidSubs += 1;
      mrrUsd += monthlyUsd(sub);
    }

    hasMore = page.has_more;
    startingAfter = page.data.length ? page.data[page.data.length - 1].id : undefined;
    if (!startingAfter) hasMore = false;
  }

  return { webPaidSubs, mrr: Math.round(mrrUsd * 100) / 100 };
}

async function fetchRaw(window: MonthWindow): Promise<Metrics> {
  const { gte, lte } = windowToUnixSeconds(window);

  let webFreeTrials = 0;
  let webActiveSubs = 0;
  let startingAfter: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const page: Stripe.ApiList<Stripe.Subscription> = await getStripe().subscriptions.list({
      created: { gte, lte },
      status: "all",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const sub of page.data) {
      if (sub.trial_start != null && sub.trial_start >= gte && sub.trial_start <= lte) {
        webFreeTrials += 1;
      }
      if (window.isCurrent && (sub.status === "trialing" || sub.status === "active")) {
        webActiveSubs += 1;
      }
    }

    hasMore = page.has_more;
    startingAfter = page.data.length ? page.data[page.data.length - 1].id : undefined;
    if (!startingAfter) hasMore = false;
  }

  if (!window.isCurrent) return { webFreeTrials };

  // MRR/ARR are a live snapshot of today's paying base, like the store
  // connectors: there is no historical view for past months.
  const { webPaidSubs, mrr } = await fetchPayingSubs();
  return { webFreeTrials, webActiveSubs, webPaidSubs, mrr, arr: arrFromMrr(mrr) };
}

export async function fetchMetrics(month?: string): Promise<ConnectorResult<Metrics>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  const window = resolveMonthWindow(month);
  try {
    const data = await fetchRaw(window);
    const asOf = window.isCurrent
      ? new Date().toISOString()
      : new Date(`${window.to}T00:00:00.000Z`).toISOString();
    return { data, asOf, status: "ok" };
  } catch (e) {
    return { data: null, asOf: null, status: "error", error: (e as Error).message };
  }
}
