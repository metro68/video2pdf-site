// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

const upsertLead = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/db/leads", () => ({
  upsertLead: (...a: unknown[]) => upsertLead(...a),
}));

import { POST } from "@/app/api/lead/route";

function req(body: unknown): Request {
  return new Request("http://test/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  upsertLead.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/lead", () => {
  it("400s when email is missing", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(upsertLead).not.toHaveBeenCalled();
  });

  it("400s when email is not a valid shape", async () => {
    const res = await POST(req({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(upsertLead).not.toHaveBeenCalled();
  });

  it("200s and stores the lead on a valid email", async () => {
    const res = await POST(req({ email: "a@b.com", scanType: "Documents", frequency: "Weekly", src: "meta_ad_1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(upsertLead).toHaveBeenCalledWith({
      email: "a@b.com",
      scanType: "Documents",
      frequency: "Weekly",
      src: "meta_ad_1",
    });
  });

  it("does not echo the email back in the response", async () => {
    const res = await POST(req({ email: "a@b.com" }));
    const text = await res.text();
    expect(text).not.toMatch(/a@b\.com/);
  });

  it("still returns 200 ok:false when the DB throws, so the funnel never breaks", async () => {
    upsertLead.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false });
  });
});
