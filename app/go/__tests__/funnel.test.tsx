import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Funnel } from "@/app/go/components/Funnel";
import * as pixel from "@/lib/pixel/events";

const fetchMock = vi.fn(
  async (): Promise<{ json: () => Promise<{ url?: string }> }> => ({
    json: async () => ({ url: "https://checkout.test/s/1" }),
  })
);
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockClear();
  vi.spyOn(pixel, "track").mockImplementation(() => {});
  vi.spyOn(pixel, "trackCustom").mockImplementation(() => {});
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

  it("fires funnel_opened with source direct when no src query param is present", () => {
    render(<Funnel />);
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_opened", { source: "direct" });
  });

  it("fires funnel_opened with the src query param when present", () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, search: "?src=meta_ad_1" },
      writable: true,
    });
    render(<Funnel />);
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_opened", { source: "meta_ad_1" });
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  it("fires funnel_get_started on landing CTA click", () => {
    render(<Funnel />);
    goToQualify();
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_get_started");
  });

  it("fires funnel_scan_type_selected and funnel_qualify1_completed through qualify1", () => {
    render(<Funnel />);
    goToQualify();
    fireEvent.click(screen.getByRole("button", { name: /documents/i }));
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_scan_type_selected", {
      scan_type: "Documents",
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_qualify1_completed", {
      scan_type: "Documents",
    });
  });

  it("fires funnel_frequency_selected and funnel_qualify2_completed through qualify2", () => {
    render(<Funnel />);
    goToQualify();
    fireEvent.click(screen.getByRole("button", { name: /documents/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /weekly/i }));
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_frequency_selected", {
      frequency: "Weekly",
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_qualify2_completed", {
      frequency: "Weekly",
    });
  });

  it("fires funnel_email_step_viewed when the email step is shown", () => {
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_email_step_viewed");
  });

  it("fires funnel_email_submitted alongside Lead", () => {
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_email_submitted");
  });

  it("fires funnel_paywall_viewed when the paywall step is shown", () => {
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_paywall_viewed");
  });

  it("fires funnel_plan_selected, funnel_checkout_redirect on weekly plan select", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "", search: "" }, writable: true });
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    fireEvent.click(await screen.findByRole("button", { name: /weekly.*4\.99/i }));
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_plan_selected", {
      plan: "weekly",
      value: 4.99,
    });
    await waitFor(() =>
      expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_checkout_redirect", { plan: "weekly" })
    );
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.test/s/1"));
  });

  it("fires funnel_checkout_error when checkout fails to return a url", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "", search: "" }, writable: true });
    fetchMock.mockImplementationOnce(async () => ({ json: async () => ({}) }));
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    const weeklyButton = await screen.findByRole("button", { name: /weekly.*4\.99/i });
    fireEvent.click(weeklyButton);
    await waitFor(() =>
      expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_checkout_error", { plan: "weekly" })
    );
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

  it("shows the trial wording on the annual plan and not on weekly", async () => {
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    const weeklyButton = await screen.findByRole("button", { name: /weekly.*4\.99/i });
    const annualButton = await screen.findByRole("button", { name: /3-day free trial.*29\.99/i });
    expect(weeklyButton).toBeInTheDocument();
    expect(weeklyButton.textContent).not.toMatch(/trial/i);
    expect(annualButton).toBeInTheDocument();
  });

  it("fires Lead after email and InitiateCheckout on weekly plan select, then redirects", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    expect(pixel.track).toHaveBeenCalledWith("Lead");
    fireEvent.click(await screen.findByRole("button", { name: /weekly.*4\.99/i }));
    expect(pixel.track).toHaveBeenCalledWith("InitiateCheckout", { value: 4.99, currency: "USD" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.test/s/1"));
  });

  it("fires InitiateCheckout with the annual value on annual plan select", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    fireEvent.click(await screen.findByRole("button", { name: /3-day free trial.*29\.99/i }));
    expect(pixel.track).toHaveBeenCalledWith("InitiateCheckout", { value: 29.99, currency: "USD" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.test/s/1"));
  });

  it("does not fire StartTrial at checkout start on the annual plan: it fires on the success page with the session eventID so it dedups against CAPI and abandons do not count", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    fireEvent.click(await screen.findByRole("button", { name: /3-day free trial.*29\.99/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(pixel.track).not.toHaveBeenCalledWith("StartTrial", expect.anything());
  });

  it("forwards the _fbp and _fbc Meta cookies with the checkout request", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
    document.cookie = "_fbp=fb.1.111.222";
    document.cookie = "_fbc=fb.1.111.IwAR333";
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    fireEvent.click(await screen.findByRole("button", { name: /weekly.*4\.99/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // fetchMock is typed arg-less for convenience; the component calls it with
    // (url, init), so the recorded call args are re-widened here to read the body.
    const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls;
    const body = JSON.parse(String(calls[0][1].body));
    expect(body.fbp).toBe("fb.1.111.222");
    expect(body.fbc).toBe("fb.1.111.IwAR333");
    document.cookie = "_fbp=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "_fbc=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  it("does not fire StartTrial on weekly plan select, since weekly has no trial", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    fireEvent.click(await screen.findByRole("button", { name: /weekly.*4\.99/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(pixel.track).not.toHaveBeenCalledWith(
      "StartTrial",
      expect.anything(),
    );
  });

  it("shows an error and re-enables the button when checkout fails to return a url", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
    fetchMock.mockImplementationOnce(async () => ({ json: async () => ({}) }));
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    const weeklyButton = await screen.findByRole("button", { name: /weekly.*4\.99/i });
    fireEvent.click(weeklyButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/something went wrong starting checkout/i)).toBeInTheDocument()
    );
    expect(assign).not.toHaveBeenCalled();
    await waitFor(() => expect(weeklyButton).not.toBeDisabled());
  });

  it("shows an error and re-enables the button when the checkout request throws", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
    fetchMock.mockImplementationOnce(async () => {
      throw new Error("network down");
    });
    render(<Funnel />);
    goToQualify();
    answerQualifyTaps();
    capturEmailAndContinue();
    const weeklyButton = await screen.findByRole("button", { name: /weekly.*4\.99/i });
    fireEvent.click(weeklyButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/something went wrong starting checkout/i)).toBeInTheDocument()
    );
    expect(assign).not.toHaveBeenCalled();
    await waitFor(() => expect(weeklyButton).not.toBeDisabled());
  });
});
