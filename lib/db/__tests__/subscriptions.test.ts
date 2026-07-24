import { describe, it, expect, vi, beforeEach } from "vitest";

const sqlMock = vi.fn(async (..._a: unknown[]) => ({ rows: [] }));
vi.mock("@vercel/postgres", () => ({ sql: (...a: unknown[]) => sqlMock(...a) }));

import { upsertSubscription, mintRedeemToken } from "@/lib/db/subscriptions";

beforeEach(() => sqlMock.mockClear());

function firstCallQueryText(): string {
  const call = sqlMock.mock.calls[0];
  if (!call) throw new Error("sqlMock was not called");
  const strings = call[0] as unknown as string[];
  return strings.join("?");
}

describe("upsertSubscription", () => {
  it("issues an INSERT ... ON CONFLICT (email) DO UPDATE", async () => {
    await upsertSubscription({
      email: "a@b.com", plan: "weekly", status: "trialing",
      stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1",
      currentPeriodEnd: 1_800_000_000_000, trialEnd: 1_790_000_000_000,
    });
    const query = firstCallQueryText();
    expect(query).toMatch(/INSERT INTO subscriptions/i);
    expect(query).toMatch(/ON CONFLICT \(email\) DO UPDATE/i);
  });
});

describe("mintRedeemToken", () => {
  it("inserts the supplied token with an expiry and returns it", async () => {
    const tok = await mintRedeemToken("a@b.com", 7 * 86400_000, "tok_fixed");
    expect(tok).toBe("tok_fixed");
    const query = firstCallQueryText();
    expect(query).toMatch(/INSERT INTO redeem_tokens/i);
  });
});
