// @vitest-environment node
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

const subsRetrieve = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  stripe: { subscriptions: { retrieve: (...a: unknown[]) => subsRetrieve(...a) } },
  PRICE_TO_PLAN: { price_a: "annual", price_w: "weekly" },
}));

const applyAnnualWinback = vi.fn().mockResolvedValue(undefined);
const applyWeeklyPause = vi.fn().mockResolvedValue(undefined);
const setCancelAtPeriodEnd = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/manage/stripeOps", () => ({
  applyAnnualWinback: (...a: unknown[]) => applyAnnualWinback(...a),
  applyWeeklyPause: (...a: unknown[]) => applyWeeklyPause(...a),
  setCancelAtPeriodEnd: (...a: unknown[]) => setCancelAtPeriodEnd(...a),
}));

const insertEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/db/cancellationEvents", () => ({
  insertCancellationEvent: (...a: unknown[]) => insertEvent(...a),
}));

import { POST as offerPOST } from "@/app/api/manage/offer/route";
import { POST as cancelPOST } from "@/app/api/manage/cancel/route";
import { POST as resumePOST } from "@/app/api/manage/resume/route";
import { POST as feedbackPOST } from "@/app/api/manage/feedback/route";
import { signManageToken } from "@/lib/manage/token";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

function req(path: string, body: unknown): Request {
  return new Request(`http://test/api/manage/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const annualSub = {
  id: "sub_1",
  status: "active",
  cancel_at_period_end: false,
  created: 1,
  metadata: {},
  items: { data: [{ price: { id: "price_a" }, current_period_end: 1_800_000_000 }] },
};

let token = "";
beforeAll(async () => {
  token = await signManageToken({ subscriptionId: "sub_1", email: "a@b.c" });
});

beforeEach(() => {
  subsRetrieve.mockReset().mockResolvedValue(annualSub);
  applyAnnualWinback.mockClear();
  applyWeeklyPause.mockClear();
  setCancelAtPeriodEnd.mockClear();
  insertEvent.mockClear();
});

describe("POST /api/manage/offer", () => {
  it("401s on a bad token", async () => {
    expect((await offerPOST(req("offer", { token: "junk" }))).status).toBe(401);
  });

  it("applies the annual winback and records the outcome", async () => {
    const res = await offerPOST(req("offer", { token }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, outcome: "saved_offer" });
    expect(applyAnnualWinback).toHaveBeenCalledWith("sub_1");
    expect(insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.c", plan: "annual", outcome: "saved_offer" }),
    );
  });

  it("pauses a weekly subscription instead", async () => {
    subsRetrieve.mockResolvedValue({
      ...annualSub,
      items: { data: [{ price: { id: "price_w" }, current_period_end: 1_800_000_000 }] },
    });
    const res = await offerPOST(req("offer", { token }));
    expect(await res.json()).toEqual({ ok: true, outcome: "paused" });
    expect(applyWeeklyPause).toHaveBeenCalledWith("sub_1", expect.any(Number));
    const resumesAt = applyWeeklyPause.mock.calls[0][1] as number;
    const expected = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    expect(Math.abs(resumesAt - expected)).toBeLessThan(60);
  });

  it("409s when already redeemed (server-side re-check)", async () => {
    subsRetrieve.mockResolvedValue({
      ...annualSub,
      metadata: { winback_redeemed: "1" },
    });
    expect((await offerPOST(req("offer", { token }))).status).toBe(409);
    expect(applyAnnualWinback).not.toHaveBeenCalled();
  });
});

describe("POST /api/manage/cancel", () => {
  it("sets cancel_at_period_end and records reason and outcome", async () => {
    const res = await cancelPOST(
      req("cancel", { token, reason: "too_expensive", comment: "x" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, endsAt: 1_800_000_000_000 });
    expect(setCancelAtPeriodEnd).toHaveBeenCalledWith("sub_1", true);
    expect(insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "too_expensive", outcome: "canceled" }),
    );
  });

  it("still cancels when the event insert fails", async () => {
    insertEvent.mockRejectedValueOnce(new Error("db down"));
    const res = await cancelPOST(req("cancel", { token }));
    expect(res.status).toBe(200);
    expect(setCancelAtPeriodEnd).toHaveBeenCalledWith("sub_1", true);
  });
});

describe("POST /api/manage/resume", () => {
  it("unsets cancel_at_period_end and records the outcome", async () => {
    const res = await resumePOST(req("resume", { token }));
    expect(res.status).toBe(200);
    expect(setCancelAtPeriodEnd).toHaveBeenCalledWith("sub_1", false);
    expect(insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "resumed" }),
    );
  });
});

describe("POST /api/manage/feedback", () => {
  it("records the survey answer", async () => {
    const res = await feedbackPOST(
      req("feedback", { token, reason: "not_using", stepReached: "survey" }),
    );
    expect(res.status).toBe(200);
    expect(insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "not_using", stepReached: "survey" }),
    );
  });

  it("rejects an unknown stepReached", async () => {
    const res = await feedbackPOST(
      req("feedback", { token, reason: "not_using", stepReached: "nope" }),
    );
    expect(res.status).toBe(400);
  });
});
