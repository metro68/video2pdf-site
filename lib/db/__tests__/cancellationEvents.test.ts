import { describe, expect, it, vi, beforeEach } from "vitest";

const sqlMock = vi.fn().mockResolvedValue({ rows: [] });
vi.mock("@/lib/db/client", () => ({
  sql: (...args: unknown[]) => sqlMock(...args),
}));

import { insertCancellationEvent } from "@/lib/db/cancellationEvents";

describe("insertCancellationEvent", () => {
  beforeEach(() => sqlMock.mockClear());

  it("inserts a row with all fields", async () => {
    await insertCancellationEvent({
      email: "User@Example.com ",
      plan: "annual",
      reason: "too_expensive",
      comment: "hi",
      stepReached: "offer",
      outcome: "saved_offer",
    });
    expect(sqlMock).toHaveBeenCalledTimes(1);
    const values = sqlMock.mock.calls[0].slice(1);
    expect(values).toContain("user@example.com");
    expect(values).toContain("saved_offer");
  });

  it("defaults reason, comment and outcome to null", async () => {
    await insertCancellationEvent({
      email: "a@b.c",
      plan: "weekly",
      stepReached: "survey",
    });
    const values = sqlMock.mock.calls[0].slice(1);
    expect(values).toContain(null);
  });
});
