import type Stripe from "stripe";
import type { Metrics } from "@/lib/types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { getStripe } from "@/lib/stripe/client";
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

  return window.isCurrent ? { webFreeTrials, webActiveSubs } : { webFreeTrials };
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
