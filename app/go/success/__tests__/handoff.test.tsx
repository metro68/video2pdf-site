import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Handoff } from "@/app/go/success/components/Handoff";
import * as pixel from "@/lib/pixel/events";

beforeEach(() => {
  vi.spyOn(pixel, "track").mockImplementation(() => {});
});

describe("Handoff", () => {
  it("links to our universal-link host with the token, without showing the token itself", () => {
    render(<Handoff token="tok_abc" value={4.99} eventId="evt_9" />);
    const link = screen.getByRole("link", { name: /open the app/i });
    expect(link).toHaveAttribute("href", "https://app.video2pdf.ai/open?token=tok_abc");
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

  it("fires StartTrial only (no Purchase) for a trial plan: the card is not charged yet, and the Purchase comes from invoice.paid server-side", () => {
    render(<Handoff token="tok_abc" value={29.99} eventId="evt_9" isTrial />);
    expect(pixel.track).toHaveBeenCalledWith(
      "StartTrial",
      { value: 29.99, currency: "USD", predicted_ltv: 29.99 },
      "evt_9",
    );
    expect(pixel.track).not.toHaveBeenCalledWith(
      "Purchase",
      expect.anything(),
      expect.anything(),
    );
  });

  it("does not fire StartTrial for a non-trial plan", () => {
    render(<Handoff token="tok_abc" value={4.99} eventId="evt_9" />);
    expect(pixel.track).not.toHaveBeenCalledWith(
      "StartTrial",
      expect.anything(),
      expect.anything(),
    );
  });

});
