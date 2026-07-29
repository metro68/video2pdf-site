import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManageForm } from "@/app/manage/components/ManageForm";

const overview = {
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

function mockLookup(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      json: async () => body,
    }),
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

async function lookupWith(body: unknown, status = 200) {
  mockLookup(body, status);
  render(<ManageForm />);
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value: "a@b.c" },
  });
  fireEvent.click(screen.getByRole("button", { name: /find my subscription/i }));
}

describe("ManageForm", () => {
  it("shows the overview after a successful lookup", async () => {
    await lookupWith({ token: "tok", overview });
    await waitFor(() => {
      expect(screen.getByText(/annual/i)).toBeTruthy();
      expect(screen.getByText(/\$29\.99/)).toBeTruthy();
      expect(screen.getByRole("button", { name: /update payment method/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /cancel subscription/i })).toBeTruthy();
    });
  });

  it("stores the flow state and navigates on cancel click", async () => {
    const assign = vi.fn();
    // jsdom's window.location is not configurable via defineProperty in all
    // versions; stubGlobal replaces the whole object for this test.
    vi.stubGlobal("location", { ...window.location, assign });
    await lookupWith({ token: "tok", overview });
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /cancel subscription/i })),
    );
    expect(JSON.parse(sessionStorage.getItem("v2p_manage") ?? "{}")).toMatchObject({
      token: "tok",
    });
    expect(assign).toHaveBeenCalledWith("/manage/cancel");
  });

  it("shows a resume button when already set to cancel", async () => {
    await lookupWith({
      token: "tok",
      overview: { ...overview, cancelAtPeriodEnd: true },
    });
    await waitFor(() => {
      expect(screen.getByText(/your plan ends on/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /resume subscription/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^cancel subscription$/i })).toBeNull();
    });
  });

  it("shows the not-found error", async () => {
    await lookupWith({ error: "No subscription found for that email" }, 404);
    await waitFor(() =>
      expect(screen.getByText(/could not find a subscription/i)).toBeTruthy(),
    );
  });
});
