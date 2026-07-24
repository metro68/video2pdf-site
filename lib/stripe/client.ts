import Stripe from "stripe";
import type { Plan } from "@/lib/db/client";

// Construct the Stripe client lazily, NOT at module load. The Next.js production
// build evaluates route modules to collect page data, and STRIPE_SECRET_KEY is
// not present during that build pass on Vercel, so a module-level
// `new Stripe(...)` throws "Neither apiKey nor config.authenticator provided" and
// fails the build. A Proxy defers construction to first property access (i.e. the
// first real request), so the API `stripe.checkout...` stays unchanged for callers
// and tests, while the secret is only read at runtime.
let cachedStripe: Stripe | null = null;

function realStripe(): Stripe {
  if (!cachedStripe) {
    cachedStripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
      // Pinned to the API version shipped with the installed "stripe" package's types.
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return cachedStripe;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(realStripe(), prop, receiver);
  },
});

// Function form of the lazy singleton above, for callers that prefer calling
// a getter over importing a Proxy-backed constant (e.g. connectors, which are
// unit tested by mocking this module).
export function getStripe(): Stripe {
  return realStripe();
}

// Read the price-to-plan mapping at access time (env is not reliably present at
// build time). A Proxy keeps the `PRICE_TO_PLAN[priceId]` call sites unchanged.
export const PRICE_TO_PLAN: Record<string, Plan> = new Proxy(
  {} as Record<string, Plan>,
  {
    get(_target, prop: string) {
      if (prop === (process.env.STRIPE_PRICE_WEEKLY ?? "price_weekly")) {
        return "weekly";
      }
      if (prop === (process.env.STRIPE_PRICE_ANNUAL ?? "price_annual")) {
        return "annual";
      }
      return undefined;
    },
  },
);
