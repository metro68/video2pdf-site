import { describe, it, expect, vi, beforeEach } from "vitest";

const sqlMock = vi.fn(async (..._a: unknown[]) => ({ rows: [] }));
vi.mock("@/lib/db/client", () => ({ sql: (...a: unknown[]) => sqlMock(...a) }));

import { upsertLead, markUnsubscribed } from "@/lib/db/leads";

beforeEach(() => sqlMock.mockClear());

function firstCallQueryText(): string {
  const call = sqlMock.mock.calls[0];
  if (!call) throw new Error("sqlMock was not called");
  const strings = call[0] as unknown as string[];
  return strings.join("?");
}

function firstCallValues(): unknown[] {
  const call = sqlMock.mock.calls[0];
  if (!call) throw new Error("sqlMock was not called");
  return call.slice(1);
}

describe("upsertLead", () => {
  it("issues an INSERT ... ON CONFLICT (email) DO UPDATE", async () => {
    await upsertLead({
      email: "A@B.com",
      scanType: "Documents",
      frequency: "Weekly",
      src: "meta_ad_1",
    });
    const query = firstCallQueryText();
    expect(query).toMatch(/INSERT INTO leads/i);
    expect(query).toMatch(/ON CONFLICT \(email\) DO UPDATE/i);
  });

  it("lowercases and trims the email", async () => {
    await upsertLead({ email: "  A@B.com  ", scanType: null, frequency: null, src: null });
    const values = firstCallValues();
    expect(values).toContain("a@b.com");
  });

  it("preserves created_at, reminder_sent_at, unsubscribed_at on conflict, refreshing only scan_type/frequency/src", async () => {
    const query = (await (async () => {
      await upsertLead({ email: "a@b.com", scanType: "Books", frequency: "Daily", src: "direct" });
      return firstCallQueryText();
    })());
    // The update clause should only touch scan_type/frequency/src (and no timestamp columns).
    const updateClauseMatch = query.match(/DO UPDATE SET([\s\S]*)/i);
    expect(updateClauseMatch).not.toBeNull();
    const updateClause = updateClauseMatch![1];
    expect(updateClause).toMatch(/scan_type/i);
    expect(updateClause).toMatch(/frequency/i);
    expect(updateClause).toMatch(/src/i);
    expect(updateClause).not.toMatch(/created_at/i);
    expect(updateClause).not.toMatch(/reminder_sent_at/i);
    expect(updateClause).not.toMatch(/unsubscribed_at/i);
  });
});

describe("markUnsubscribed", () => {
  it("updates the leads row for the given email", async () => {
    await markUnsubscribed("a@b.com");
    const query = firstCallQueryText();
    expect(query).toMatch(/UPDATE leads/i);
    expect(query).toMatch(/unsubscribed_at/i);
    const values = firstCallValues();
    expect(values).toContain("a@b.com");
  });
});
