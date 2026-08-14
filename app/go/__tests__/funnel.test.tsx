import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Funnel } from "@/app/go/components/Funnel";
import * as pixel from "@/lib/pixel/events";

// The email step now also fires a fire-and-forget POST to /api/lead alongside
// the checkout step's POST to /api/checkout, so the default mock routes by URL.
// Tests that need to simulate a checkout failure override checkoutImpl rather
// than fetchMock directly, so the /api/lead call (which the component never
// awaits or reads the response of) is unaffected.
let checkoutImpl: () => Promise<{ json: () => Promise<{ url?: string }> }> = async () => ({
  json: async () => ({ url: "https://checkout.test/s/1" }),
});
const fetchMock = vi.fn(async (url: string) => {
  if (url === "/api/lead") {
    return { json: async () => ({ ok: true }) };
  }
  return checkoutImpl();
});
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockClear();
  checkoutImpl = async () => ({ json: async () => ({ url: "https://checkout.test/s/1" }) });
  vi.spyOn(pixel, "track").mockImplementation(() => {});
  vi.spyOn(pixel, "trackCustom").mockImplementation(() => {});
});

function goToEmail() {
  fireEvent.click(screen.getByRole("button", { name: /get started/i }));
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
    goToEmail();
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_get_started");
  });

  it("fires funnel_email_step_viewed when the email step is shown", () => {
    render(<Funnel />);
    goToEmail();
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_email_step_viewed");
  });

  it("fires funnel_email_submitted alongside Lead", () => {
    render(<Funnel />);
    goToEmail();
    capturEmailAndContinue();
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_email_submitted");
  });

  it("posts the lead to /api/lead on the email step's Continue, without blocking the step advance", async () => {
    render(<Funnel />);
    goToEmail();
    capturEmailAndContinue();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/lead",
        expect.objectContaining({
          method: "POST",
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    const leadCall = calls.find(([url]) => url === "/api/lead")!;
    const body = JSON.parse(String(leadCall[1].body));
    expect(body).toEqual({
      email: "a@b.com",
      src: "direct",
    });
    // The paywall step is shown immediately; the lead POST does not block advancing.
    expect(screen.getByText(/unlock video2pdf pro/i)).toBeInTheDocument();
  });

  it("includes the src query param in the lead POST", async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, search: "?src=meta_ad_1" },
      writable: true,
    });
    render(<Funnel />);
    goToEmail();
    capturEmailAndContinue();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/lead", expect.anything()));
    const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    const leadCall = calls.find(([url]) => url === "/api/lead")!;
    const body = JSON.parse(String(leadCall[1].body));
    expect(body.src).toBe("meta_ad_1");
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  it("carries utm_campaign and utm_content from the URL into both the lead src and the checkout body", async () => {
    const assign = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: {
        ...originalLocation,
        assign,
        href: "",
        search: "?src=meta&utm_campaign=aug-ugc&utm_content=120210000001",
      },
      writable: true,
    });
    render(<Funnel />);
    goToEmail();
    capturEmailAndContinue();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/lead", expect.anything()));
    const leadCalls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    const leadCall = leadCalls.find(([url]) => url === "/api/lead")!;
    const leadBody = JSON.parse(String(leadCall[1].body));
    expect(leadBody.src).toBe("meta|c:aug-ugc|a:120210000001");

    fireEvent.click(await screen.findByRole("button", { name: /weekly.*4\.99/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/checkout", expect.anything()));
    const checkoutCalls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls;
    const checkoutCall = checkoutCalls.find(([url]) => url === "/api/checkout")!;
    const checkoutBody = JSON.parse(String(checkoutCall[1].body));
    expect(checkoutBody.utmCampaign).toBe("aug-ugc");
    expect(checkoutBody.utmContent).toBe("120210000001");

    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  it("omits the dangling a: segment when only utm_campaign is present", async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, search: "?src=meta&utm_campaign=aug-ugc" },
      writable: true,
    });
    render(<Funnel />);
    goToEmail();
    capturEmailAndContinue();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/lead", expect.anything()));
    const leadCalls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    const leadCall = leadCalls.find(([url]) => url === "/api/lead")!;
    const leadBody = JSON.parse(String(leadCall[1].body));
    expect(leadBody.src).toBe("meta|c:aug-ugc");
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  it("omits the dangling c: segment when only utm_content is present", async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, search: "?src=meta&utm_content=120210000001" },
      writable: true,
    });
    render(<Funnel />);
    goToEmail();
    capturEmailAndContinue();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/lead", expect.anything()));
    const leadCalls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    const leadCall = leadCalls.find(([url]) => url === "/api/lead")!;
    const leadBody = JSON.parse(String(leadCall[1].body));
    expect(leadBody.src).toBe("meta|a:120210000001");
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  it("fires funnel_paywall_viewed when the paywall step is shown", () => {
    render(<Funnel />);
    goToEmail();
    capturEmailAndContinue();
    expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_paywall_viewed");
  });

  it("fires funnel_plan_selected, funnel_checkout_redirect on weekly plan select", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "", search: "" }, writable: true });
    render(<Funnel />);
    goToEmail();
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
    checkoutImpl = async () => ({ json: async () => ({}) });
    render(<Funnel />);
    goToEmail();
    capturEmailAndContinue();
    const weeklyButton = await screen.findByRole("button", { name: /weekly.*4\.99/i });
    fireEvent.click(weeklyButton);
    await waitFor(() =>
      expect(pixel.trackCustom).toHaveBeenCalledWith("funnel_checkout_error", { plan: "weekly" })
    );
  });

  it("shows the social-proof anchor and pricing on the paywall", async () => {
    render(<Funnel />);
    goToEmail();
    capturEmailAndContinue();
    await waitFor(() => expect(screen.getByText(/12,000\+/)).toBeInTheDocument());
    expect(screen.getByText("$4.99")).toBeInTheDocument();
    expect(screen.getByText("$29.99")).toBeInTheDocument();
    expect(screen.getByText("Unlimited documents")).toBeInTheDocument();
  });

  it("shows the trial wording on the annual plan and not on weekly", async () => {
    render(<Funnel />);
    goToEmail();
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
    goToEmail();
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
    goToEmail();
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
    goToEmail();
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
    goToEmail();
    capturEmailAndContinue();
    fireEvent.click(await screen.findByRole("button", { name: /weekly.*4\.99/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/checkout", expect.anything()));
    // fetchMock is typed arg-less for convenience; the component calls it with
    // (url, init), so the recorded call args are re-widened here to read the body.
    const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls;
    const checkoutCall = calls.find(([url]) => url === "/api/checkout")!;
    const body = JSON.parse(String(checkoutCall[1].body));
    expect(body.fbp).toBe("fb.1.111.222");
    expect(body.fbc).toBe("fb.1.111.IwAR333");
    document.cookie = "_fbp=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "_fbc=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  it("does not fire StartTrial on weekly plan select, since weekly has no trial", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
    render(<Funnel />);
    goToEmail();
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
    checkoutImpl = async () => ({ json: async () => ({}) });
    render(<Funnel />);
    goToEmail();
    capturEmailAndContinue();
    const weeklyButton = await screen.findByRole("button", { name: /weekly.*4\.99/i });
    fireEvent.click(weeklyButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/checkout", expect.anything()));
    await waitFor(() =>
      expect(screen.getByText(/something went wrong starting checkout/i)).toBeInTheDocument()
    );
    expect(assign).not.toHaveBeenCalled();
    await waitFor(() => expect(weeklyButton).not.toBeDisabled());
  });

  it("shows an error and re-enables the button when the checkout request throws", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
    checkoutImpl = async () => {
      throw new Error("network down");
    };
    render(<Funnel />);
    goToEmail();
    capturEmailAndContinue();
    const weeklyButton = await screen.findByRole("button", { name: /weekly.*4\.99/i });
    fireEvent.click(weeklyButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/checkout", expect.anything()));
    await waitFor(() =>
      expect(screen.getByText(/something went wrong starting checkout/i)).toBeInTheDocument()
    );
    expect(assign).not.toHaveBeenCalled();
    await waitFor(() => expect(weeklyButton).not.toBeDisabled());
  });
});
