import Stripe from "stripe";
import type { Plan } from "@/lib/db/client";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  // Pinned to the API version shipped with the installed "stripe" package's types.
  apiVersion: "2026-06-24.dahlia",
});

export const PRICE_TO_PLAN: Record<string, Plan> = {
  [process.env.STRIPE_PRICE_WEEKLY ?? "price_weekly"]: "weekly",
  [process.env.STRIPE_PRICE_ANNUAL ?? "price_annual"]: "annual",
};
