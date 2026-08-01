// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

const markUnsubscribed = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/db/leads", () => ({
  markUnsubscribed: (...a: unknown[]) => markUnsubscribed(...a),
}));

import { GET } from "@/app/api/unsubscribe/route";
import { unsubscribeToken } from "@/lib/email/unsubscribe";

beforeEach(() => {
  markUnsubscribed.mockClear();
  process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
});

function req(email: string, token: string): Request {
  const url = new URL("http://test/api/unsubscribe");
  url.searchParams.set("e", email);
  url.searchParams.set("t", token);
  return new Request(url);
}

describe("GET /api/unsubscribe", () => {
  it("marks the email unsubscribed and returns a confirmation page on a valid token", async () => {
    const token = unsubscribeToken("a@b.com");
    const res = await GET(req("a@b.com", token));
    expect(res.status).toBe(200);
    expect(markUnsubscribed).toHaveBeenCalledWith("a@b.com");
    const text = await res.text();
    expect(text).toMatch(/unsubscribed/i);
  });

  it("400s on an invalid token", async () => {
    const res = await GET(req("a@b.com", "not-the-right-token"));
    expect(res.status).toBe(400);
    expect(markUnsubscribed).not.toHaveBeenCalled();
  });

  it("400s when the email or token is missing", async () => {
    const res = await GET(new Request("http://test/api/unsubscribe"));
    expect(res.status).toBe(400);
    expect(markUnsubscribed).not.toHaveBeenCalled();
  });
});
