import { createHmac, timingSafeEqual } from "node:crypto";

// Falls back to STRIPE_WEBHOOK_SECRET when UNSUBSCRIBE_SECRET is unset, so the
// unsubscribe link works without provisioning a new env var. Set UNSUBSCRIBE_SECRET
// explicitly in production if the webhook secret ever needs to rotate independently.
function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET ?? "";
}

export function unsubscribeToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHmac("sha256", secret()).update(normalized).digest("hex");
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email);
  const expectedBuf = Buffer.from(expected, "hex");
  const tokenBuf = Buffer.from(token, "hex");
  if (expectedBuf.length !== tokenBuf.length) return false;
  return timingSafeEqual(expectedBuf, tokenBuf);
}
