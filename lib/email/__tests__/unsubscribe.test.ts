// @vitest-environment node
import { describe, expect, it, beforeEach } from "vitest";
import { unsubscribeToken, verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

beforeEach(() => {
  process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("unsubscribe token", () => {
  it("round-trips: a token minted for an email verifies for that email", () => {
    const token = unsubscribeToken("a@b.com");
    expect(verifyUnsubscribeToken("a@b.com", token)).toBe(true);
  });

  it("is case-insensitive on the email", () => {
    const token = unsubscribeToken("a@b.com");
    expect(verifyUnsubscribeToken("A@B.com", token)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const token = unsubscribeToken("a@b.com");
    expect(verifyUnsubscribeToken("a@b.com", token.slice(0, -2) + "zz")).toBe(false);
  });

  it("rejects a token minted for a different email", () => {
    const token = unsubscribeToken("a@b.com");
    expect(verifyUnsubscribeToken("other@b.com", token)).toBe(false);
  });

  it("falls back to STRIPE_WEBHOOK_SECRET when UNSUBSCRIBE_SECRET is unset", () => {
    delete process.env.UNSUBSCRIBE_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "webhook-secret-fallback";
    const token = unsubscribeToken("a@b.com");
    expect(verifyUnsubscribeToken("a@b.com", token)).toBe(true);
  });
});
