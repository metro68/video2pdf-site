import { describe, it, expect } from "vitest";
import { redactForRole } from "@/lib/redact";

describe("redactForRole", () => {
  const payload = { downloads: 100, churnRate: 0.05, mrr: 5000, arr: 60000 };

  it("removes mrr and arr for marketing", () => {
    const out = redactForRole(payload, "marketing");
    expect(out).not.toHaveProperty("mrr");
    expect(out).not.toHaveProperty("arr");
    expect(out.downloads).toBe(100);
    expect(out.churnRate).toBe(0.05);
  });

  it("keeps mrr and arr for admin", () => {
    const out = redactForRole(payload, "admin");
    expect(out.mrr).toBe(5000);
    expect(out.arr).toBe(60000);
  });

  it("does not mutate the input", () => {
    redactForRole(payload, "marketing");
    expect(payload.mrr).toBe(5000);
  });
});
