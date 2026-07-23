import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Funnel } from "@/app/go/components/Funnel";
import * as pixel from "@/lib/pixel/events";

const fetchMock = vi.fn(async () => ({ json: async () => ({ url: "https://checkout.test/s/1" }) }));
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockClear();
  vi.spyOn(pixel, "track").mockImplementation(() => {});
});

function goToQualify() {
  fireEvent.click(screen.getByRole("button", { name: /get started/i }));
}

function answerQualifyTaps() {
  // Question 1: what do you scan most
  fireEvent.click(screen.getByRole("button", { name: /documents/i }));
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  // Question 2: how often
  fireEvent.click(screen.getByRole("button", { name: /weekly/i }));
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
}

function capturEmailAndContinue() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
}

describe("Funnel", () => {
  it("fires ViewContent on mount", () => {
    render(<Funnel />);
    expect(pixel.track).toHaveBeenCalledWith("ViewContent");
  });

  it("renders the qualify taps and lets the user select an option", () => {
    render(<Funnel />);
    goToQualify();
    expect(screen.getByText(/what do you scan most/i)).toBeInTheDocument();
    const documentsBtn = screen.getByRole("button", { name: /documents/i });
    expect(documentsBtn).toBeInTheDocument();
    fireEvent.click(documentsBtn);
    expect(documentsBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the social-proof anchor and pricing on the paywall", async () => {
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    await waitFor(() => expect(screen.getByText(/12,000\+/)).toBeInTheDocument());
    expect(screen.getByText("$4.99")).toBeInTheDocument();
    expect(screen.getByText("$29.99")).toBeInTheDocument();
    expect(screen.getByText("Unlimited documents")).toBeInTheDocument();
  });

  it("fires Lead after email and InitiateCheckout on plan select, then redirects", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    expect(pixel.track).toHaveBeenCalledWith("Lead");
    fireEvent.click(await screen.findByRole("button", { name: /start.*4\.99/i }));
    expect(pixel.track).toHaveBeenCalledWith("InitiateCheckout", { value: 4.99, currency: "USD" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.test/s/1"));
  });
});
