import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrackedLink } from "@/app/components/TrackedLink";
import * as pixel from "@/lib/pixel/events";

beforeEach(() => {
  vi.spyOn(pixel, "trackCustom").mockImplementation(() => {});
});

describe("TrackedLink", () => {
  it("renders an anchor with the given href and children", () => {
    render(
      <TrackedLink href="/go" event="cta_start_trial_clicked">
        Start Your Free Trial
      </TrackedLink>
    );
    const link = screen.getByRole("link", { name: /start your free trial/i });
    expect(link).toHaveAttribute("href", "/go");
  });

  it("applies the given className", () => {
    render(
      <TrackedLink href="/go" event="cta_start_trial_clicked" className="cta-btn">
        Start Your Free Trial
      </TrackedLink>
    );
    expect(screen.getByRole("link", { name: /start your free trial/i })).toHaveClass("cta-btn");
  });

  it("fires trackCustom with event and params on click", () => {
    render(
      <TrackedLink href="/go" event="cta_start_trial_clicked" params={{ location: "pricing" }}>
        Start Your Free Trial
      </TrackedLink>
    );
    fireEvent.click(screen.getByRole("link", { name: /start your free trial/i }));
    expect(pixel.trackCustom).toHaveBeenCalledWith("cta_start_trial_clicked", { location: "pricing" });
  });

  it("fires trackCustom with no params when none are given", () => {
    render(
      <TrackedLink href="/manage" event="cta_manage_clicked">
        Manage Subscription
      </TrackedLink>
    );
    fireEvent.click(screen.getByRole("link", { name: /manage subscription/i }));
    expect(pixel.trackCustom).toHaveBeenCalledWith("cta_manage_clicked", undefined);
  });
});
