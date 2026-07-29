// @vitest-environment node
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

const subsRetrieve = vi.fn();
const sessionsCreate = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    subscriptions: { retrieve: (...a: unknown[]) => subsRetrieve(...a) },
    billingPortal: {
      sessions: { create: (...a: unknown[]) => sessionsCreate(...a) },
    },
  },
  PRICE_TO_PLAN: { price_a: "annual" },
}));

const ensurePortalConfiguration = vi.fn();
vi.mock("@/lib/manage/stripeOps", () => ({
  ensurePortalConfiguration: (...a: unknown[]) => ensurePortalConfiguration(...a),
}));

import { POST } from "@/app/api/manage/portal/route";
import { signManageToken } from "@/lib/manage/token";

let token = "";
beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  token = await signManageToken({ subscriptionId: "sub_1", email: "a@b.c" });
});

beforeEach(() => {
  subsRetrieve.mockReset().mockResolvedValue({
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    created: 1,
    metadata: {},
    items: { data: [{ price: { id: "price_a" }, current_period_end: 1 }] },
  });
  sessionsCreate.mockReset().mockResolvedValue({ url: "https://portal" });
  ensurePortalConfiguration.mockReset().mockResolvedValue("bpc_default");
});

function req(body: unknown): Request {
  return new Request("http://test/api/manage/portal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/manage/portal", () => {
  it("401s on a bad token", async () => {
    expect((await POST(req({ token: "junk" }))).status).toBe(401);
  });

  it("creates a session with the cancel-disabled configuration by default", async () => {
    const res = await POST(req({ token }));
    expect(await res.json()).toEqual({ url: "https://portal" });
    expect(ensurePortalConfiguration).toHaveBeenCalledWith(false);
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1", configuration: "bpc_default" }),
    );
  });

  it("uses the cancel-enabled configuration for the fallback", async () => {
    await POST(req({ token, fallbackCancel: true }));
    expect(ensurePortalConfiguration).toHaveBeenCalledWith(true);
  });
});
