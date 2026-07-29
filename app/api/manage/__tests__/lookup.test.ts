// @vitest-environment node
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

const customersList = vi.fn();
const subscriptionsList = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    customers: { list: (...a: unknown[]) => customersList(...a) },
    subscriptions: { list: (...a: unknown[]) => subscriptionsList(...a) },
  },
  PRICE_TO_PLAN: { price_a: "annual", price_w: "weekly" },
}));

import { POST } from "@/app/api/manage/lookup/route";
import { verifyManageToken } from "@/lib/manage/token";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

function req(body: unknown): Request {
  return new Request("http://test/api/manage/lookup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const liveSub = {
  id: "sub_1",
  status: "active",
  cancel_at_period_end: false,
  created: 100,
  metadata: {},
  items: { data: [{ price: { id: "price_a" }, current_period_end: 1_800_000_000 }] },
};

describe("POST /api/manage/lookup", () => {
  beforeEach(() => {
    customersList.mockReset();
    subscriptionsList.mockReset();
  });

  it("400s without an email", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });

  it("404s when no customer exists", async () => {
    customersList.mockResolvedValue({ data: [] });
    expect((await POST(req({ email: "a@b.c" }))).status).toBe(404);
  });

  it("404s when the customer has no live subscription", async () => {
    customersList.mockResolvedValue({ data: [{ id: "cus_1" }] });
    subscriptionsList.mockResolvedValue({ data: [{ ...liveSub, status: "canceled" }] });
    expect((await POST(req({ email: "a@b.c" }))).status).toBe(404);
  });

  it("returns an overview and a valid manage token", async () => {
    customersList.mockResolvedValue({ data: [{ id: "cus_1" }] });
    subscriptionsList.mockResolvedValue({ data: [liveSub] });
    const res = await POST(req({ email: "A@B.c " }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overview.plan).toBe("annual");
    expect(await verifyManageToken(body.token)).toEqual({
      subscriptionId: "sub_1",
      email: "a@b.c",
    });
    expect(customersList).toHaveBeenCalledWith({ email: "a@b.c", limit: 1 });
    expect(subscriptionsList).toHaveBeenCalledWith({
      customer: "cus_1",
      status: "all",
      limit: 10,
    });
  });
});
