import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Handoff } from "@/app/go/success/components/Handoff";
import * as pixel from "@/lib/pixel/events";

beforeEach(() => {
  vi.spyOn(pixel, "track").mockImplementation(() => {});
});

describe("Handoff", () => {
  it("renders the deep link with the token, without showing the token itself", () => {
    render(<Handoff token="tok_abc" value={4.99} eventId="evt_9" />);
    const link = screen.getByRole("link", { name: /open the app/i });
    expect(link).toHaveAttribute("href", "video2pdf://redeem?token=tok_abc");
    // The token is deep-link plumbing only; the visible fallback is the email.
    expect(screen.queryByText("tok_abc")).not.toBeInTheDocument();
  });

  it("explains the email fallback for other devices", () => {
    render(<Handoff token="tok_abc" value={4.99} eventId="evt_9" />);
    expect(
      screen.getByText(/enter the\s+email you used at checkout/i),
    ).toBeInTheDocument();
  });

  it("fires Purchase with value, currency, and the dedup eventId", () => {
    render(<Handoff token="tok_abc" value={4.99} eventId="evt_9" />);
    expect(pixel.track).toHaveBeenCalledWith("Purchase", { value: 4.99, currency: "USD" }, "evt_9");
  });

  it("fires Purchase exactly once even under repeated mounts (strict-mode guard)", () => {
    const { unmount } = render(<Handoff token="tok_abc" value={4.99} eventId="evt_9" />);
    unmount();
    expect(pixel.track).toHaveBeenCalledTimes(1);
  });

  it("shows a footer link to manage or cancel the subscription", () => {
    render(<Handoff token="tok_abc" value={4.99} eventId="evt_9" />);
    const link = screen.getByRole("link", { name: /manage or cancel anytime/i });
    expect(link).toHaveAttribute("href", "/manage");
  });

  it("falls back to the OneLink store URL when the app does not open", () => {
    vi.useFakeTimers();
    const loc = { href: "" };
    Object.defineProperty(window, "location", { value: loc, writable: true });
    render(<Handoff token="tok_abc" value={4.99} eventId="evt_9" />);
    fireEvent.click(screen.getByRole("link", { name: /open the app/i }));
    expect(loc.href).toBe("video2pdf://redeem?token=tok_abc");
    vi.advanceTimersByTime(1600);
    expect(loc.href).toContain("video2pdf.onelink.me");
    expect(loc.href).toContain("deep_link_value=redeem");
    expect(loc.href).toContain("deep_link_sub1=tok_abc");
    vi.useRealTimers();
  });
});
