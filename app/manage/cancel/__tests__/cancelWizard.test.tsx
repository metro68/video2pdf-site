import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CancelWizard } from "@/app/manage/cancel/components/CancelWizard";

const annual = {
  plan: "annual",
  priceLabel: "$29.99",
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: 1_800_000_000_000,
  trialing: false,
  pastDue: false,
  winbackRedeemed: false,
  pauseRedeemed: false,
  offerAvailable: true,
};

function seed(overview: object) {
  sessionStorage.setItem("v2p_manage", JSON.stringify({ token: "tok", overview }));
}

function mockFetch(responses: Record<string, unknown> = {}) {
  const calls: Array<{ url: string; body: unknown }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      const body = responses[url] ?? { ok: true };
      return { ok: true, status: 200, json: async () => body };
    }),
  );
  return calls;
}

interface RouteResponse {
  ok?: boolean;
  status?: number;
  url?: string;
}

function mockFetchPerRoute(routes: Record<string, RouteResponse>) {
  const calls: Array<{ url: string; body: unknown }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ url, body });
      const route = routes[url] ?? { ok: true, status: 200 };
      const status = route.status ?? (route.ok === false ? 500 : 200);
      return {
        ok: route.ok ?? status < 400,
        status,
        json: async () => route,
      };
    }),
  );
  return calls;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function advancePastSurvey() {
  fireEvent.click(screen.getByRole("button", { name: /too expensive/i }));
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
}

describe("CancelWizard", () => {
  it("walks survey, loss, offer, confirm to done, with continue-to-cancel on every step", async () => {
    seed(annual);
    const calls = mockFetch({
      "/api/manage/cancel": { ok: true, endsAt: annual.currentPeriodEnd },
    });
    render(<CancelWizard />);

    // survey
    expect(screen.getByText(/what's not working/i)).toBeTruthy();
    expect(screen.getByText(/continue to cancel/i)).toBeTruthy();
    advancePastSurvey();

    // loss
    expect(await screen.findByText(/here's what you'll lose/i)).toBeTruthy();
    expect(screen.getByText(/crisp, clean pdfs generated from your videos/i)).toBeTruthy();
    expect(screen.getByText(/only on video2pdf/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/continue to cancel/i));

    // offer
    expect(await screen.findByText(/stay for \$0\.99/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/no thanks, cancel my plan/i));

    // confirm
    expect(await screen.findByText(/your plan will end on/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /cancel my subscription/i }));

    await waitFor(() => expect(screen.getByText(/canceled\./i)).toBeTruthy());
    const cancelCall = calls.find((c) => c.url === "/api/manage/cancel");
    expect(cancelCall?.body).toMatchObject({ token: "tok", reason: "too_expensive" });
  });

  it("accepting the annual offer short-circuits to the saved view", async () => {
    seed(annual);
    mockFetch({ "/api/manage/offer": { ok: true, outcome: "saved_offer" } });
    render(<CancelWizard />);
    advancePastSurvey();
    fireEvent.click(await screen.findByText(/continue to cancel/i));
    fireEvent.click(await screen.findByRole("button", { name: /claim my \$0\.99 year/i }));
    await waitFor(() =>
      expect(screen.getByText(/your next year is \$0\.99/i)).toBeTruthy(),
    );
  });

  it("shows the pause offer for weekly", async () => {
    seed({ ...annual, plan: "weekly", priceLabel: "$4.99" });
    mockFetch();
    render(<CancelWizard />);
    advancePastSurvey();
    fireEvent.click(await screen.findByText(/continue to cancel/i));
    expect(await screen.findByText(/take 30 days on us/i)).toBeTruthy();
  });

  it("shows the deferred second-year offer for a trialing annual subscription", async () => {
    seed({ ...annual, status: "trialing", trialing: true });
    mockFetch();
    render(<CancelWizard />);
    advancePastSurvey();
    fireEvent.click(await screen.findByText(/continue to cancel/i));
    expect(await screen.findByText(/your second year for \$0\.99/i)).toBeTruthy();
    expect(
      screen.getByText(/renews at \$29\.99 on .* as scheduled/i),
    ).toBeTruthy();
    expect(screen.queryByText(/^Stay for \$0\.99$/)).toBeNull();
  });

  it("skips the offer step when offerAvailable is false", async () => {
    seed({ ...annual, winbackRedeemed: true, offerAvailable: false });
    mockFetch();
    render(<CancelWizard />);
    advancePastSurvey();
    fireEvent.click(await screen.findByText(/continue to cancel/i));
    expect(await screen.findByText(/your plan will end on/i)).toBeTruthy();
    expect(screen.queryByText(/stay for \$0\.99/i)).toBeNull();
  });

  it("keep-my-benefits exits with the kept view", async () => {
    seed(annual);
    const calls = mockFetch();
    render(<CancelWizard />);
    advancePastSurvey();
    fireEvent.click(await screen.findByRole("button", { name: /keep my benefits/i }));
    await waitFor(() => expect(screen.getByText(/great choice/i)).toBeTruthy());
    const fb = calls.filter((c) => c.url === "/api/manage/feedback");
    expect(fb.some((c) => (c.body as { outcome?: string }).outcome === "abandoned_kept")).toBe(true);
  });

  it("redirects to /manage when sessionStorage is empty", () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    render(<CancelWizard />);
    expect(replace).toHaveBeenCalledWith("/manage");
  });

  it("clears the stashed session and redirects to /manage on a 401", async () => {
    seed(annual);
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    mockFetchPerRoute({ "/api/manage/cancel": { ok: false, status: 401 } });
    render(<CancelWizard />);
    advancePastSurvey();
    fireEvent.click(await screen.findByText(/continue to cancel/i));
    fireEvent.click(await screen.findByText(/no thanks, cancel my plan/i));
    fireEvent.click(await screen.findByRole("button", { name: /cancel my subscription/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/manage"));
    expect(sessionStorage.getItem("v2p_manage")).toBeNull();
  });

  it("shows a not-available notice and falls back to confirm on a 409 offer response", async () => {
    seed(annual);
    mockFetchPerRoute({ "/api/manage/offer": { ok: false, status: 409 } });
    render(<CancelWizard />);
    advancePastSurvey();
    fireEvent.click(await screen.findByText(/continue to cancel/i));
    fireEvent.click(await screen.findByRole("button", { name: /claim my \$0\.99 year/i }));
    expect(await screen.findByText(/your plan will end on/i)).toBeTruthy();
    expect(screen.getByText(/that offer is no longer available/i)).toBeTruthy();
  });

  it("offers the billing-provider fallback after two failed cancel attempts", async () => {
    seed(annual);
    const calls = mockFetchPerRoute({
      "/api/manage/cancel": { ok: false, status: 500 },
      "/api/manage/portal": { ok: true, status: 200, url: "https://billing.stripe.com/session" },
    });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<CancelWizard />);
    advancePastSurvey();
    fireEvent.click(await screen.findByText(/continue to cancel/i));
    fireEvent.click(await screen.findByText(/no thanks, cancel my plan/i));

    const cancelButton = await screen.findByRole("button", { name: /cancel my subscription/i });
    fireEvent.click(cancelButton);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    fireEvent.click(cancelButton);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /cancel through our billing provider/i }),
      ).toBeTruthy(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /cancel through our billing provider/i }),
    );
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://billing.stripe.com/session"));
    const portalCall = calls.find((c) => c.url === "/api/manage/portal");
    expect(portalCall?.body).toMatchObject({ token: "tok", fallbackCancel: true });
  });
});
