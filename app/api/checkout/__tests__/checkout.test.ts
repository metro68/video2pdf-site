// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { create } = vi.hoisted(() => ({
  create: vi.fn(async (..._a: unknown[]) => ({ url: "https://checkout.stripe.test/s/1" })),
}));
vi.mock("@/lib/stripe/client", () => ({
  stripe: { checkout: { sessions: { create } } },
  PRICE_TO_PLAN: {},
}));
vi.stubEnv("STRIPE_PRICE_WEEKLY", "price_weekly");
vi.stubEnv("STRIPE_PRICE_ANNUAL", "price_annual");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://video2pdf.ai");

import { POST } from "@/app/api/checkout/route";

beforeEach(() => create.mockClear());

function req(body: unknown) {
  return new Request("https://video2pdf.ai/api/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function firstCallArgs(): {
  mode: string;
  customer_email: string;
  line_items: { price: string; quantity: number }[];
  subscription_data: { trial_period_days?: number; metadata: { email: string } };
  success_url: string;
} {
  const call = create.mock.calls[0];
  if (!call) throw new Error("create was not called");
  return call[0] as unknown as ReturnType<typeof firstCallArgs>;
}

describe("POST /api/checkout", () => {
  it("creates a weekly subscription session with no trial and email metadata", async () => {
    const res = await POST(req({ plan: "weekly", email: "a@b.com" }));
    const json = await res.json();
    expect(json.url).toBe("https://checkout.stripe.test/s/1");
    const args = firstCallArgs();
    expect(args.mode).toBe("subscription");
    expect(args.customer_email).toBe("a@b.com");
    expect(args.subscription_data.trial_period_days).toBeUndefined();
    expect(args.subscription_data.metadata.email).toBe("a@b.com");
    expect(args.line_items[0].price).toBe("price_weekly");
  });

  it("creates an annual session with a 3-day trial", async () => {
    await POST(req({ plan: "annual", email: "a@b.com" }));
    const args = firstCallArgs();
    expect(args.line_items[0].price).toBe("price_annual");
    expect(args.subscription_data.trial_period_days).toBe(3);
  });

  it("400s on a bad plan", async () => {
    const res = await POST(req({ plan: "lifetime", email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("400s on missing email", async () => {
    const res = await POST(req({ plan: "weekly" }));
    expect(res.status).toBe(400);
  });

  it("400s on invalid email type", async () => {
    const res = await POST(req({ plan: "weekly", email: 12345 }));
    expect(res.status).toBe(400);
  });

  it("sets success_url with CHECKOUT_SESSION_ID placeholder", async () => {
    await POST(req({ plan: "weekly", email: "a@b.com" }));
    const args = firstCallArgs();
    expect(args.success_url).toContain("session_id={CHECKOUT_SESSION_ID}");
  });
});
