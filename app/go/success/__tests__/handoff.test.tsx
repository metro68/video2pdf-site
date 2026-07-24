import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Handoff } from "@/app/go/success/components/Handoff";
import * as pixel from "@/lib/pixel/events";

beforeEach(() => {
  vi.spyOn(pixel, "track").mockImplementation(() => {});
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("Handoff", () => {
  it("renders the deep link and manual code", () => {
    render(<Handoff token="tok_abc" value={4.99} eventId="evt_9" />);
    const link = screen.getByRole("link", { name: /open the app/i });
    expect(link).toHaveAttribute("href", "video2pdf://redeem?token=tok_abc");
    expect(screen.getByText("tok_abc")).toBeInTheDocument();
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

  it("copies the code to the clipboard and shows a confirmation", async () => {
    render(<Handoff token="tok_abc" value={4.99} eventId="evt_9" />);
    const copyButton = screen.getByRole("button", { name: /copy code/i });
    fireEvent.click(copyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("tok_abc");
    await waitFor(() => expect(screen.getByText(/copied/i)).toBeInTheDocument());
  });
});
