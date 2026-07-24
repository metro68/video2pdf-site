// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { customersList, portalSessionsCreate } = vi.hoisted(() => ({
  customersList: vi.fn(async (..._a: unknown[]) => ({ data: [{ id: "cus_1" }] })),
  portalSessionsCreate: vi.fn(async (..._a: unknown[]) => ({
    url: "https://billing.stripe.test/p/session_1",
  })),
}));
vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    customers: { list: customersList },
    billingPortal: { sessions: { create: portalSessionsCreate } },
  },
}));
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://video2pdf.ai");

import { POST } from "@/app/api/portal/route";

beforeEach(() => {
  customersList.mockClear();
  portalSessionsCreate.mockClear();
  customersList.mockResolvedValue({ data: [{ id: "cus_1" }] });
  portalSessionsCreate.mockResolvedValue({ url: "https://billing.stripe.test/p/session_1" });
});

function req(body: unknown) {
  return new Request("https://video2pdf.ai/api/portal", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/portal", () => {
  it("400s on missing email", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("400s on invalid email type", async () => {
    const res = await POST(req({ email: 12345 }));
    expect(res.status).toBe(400);
  });

  it("404s when no Stripe customer is found for the email", async () => {
    customersList.mockResolvedValue({ data: [] });
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("No subscription found for that email");
  });

  it("returns a portal url when a customer exists", async () => {
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe("https://billing.stripe.test/p/session_1");
  });

  it("looks up the customer by trimmed, lowercased email", async () => {
    await POST(req({ email: "  A@B.COM  " }));
    expect(customersList).toHaveBeenCalledWith({ email: "a@b.com", limit: 1 });
  });

  it("creates the portal session for the found customer id with a return_url back to /manage", async () => {
    await POST(req({ email: "a@b.com" }));
    expect(portalSessionsCreate).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://video2pdf.ai/manage",
    });
  });

  it("returns 500 with an error message when Stripe throws", async () => {
    customersList.mockImplementation(async () => {
      throw new Error("stripe down");
    });
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});
