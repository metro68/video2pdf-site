import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileMenu } from "@/app/components/MobileMenu";
import * as pixel from "@/lib/pixel/events";

beforeEach(() => {
  vi.spyOn(pixel, "trackCustom").mockImplementation(() => {});
});

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
}

describe("MobileMenu", () => {
  it("fires cta_start_trial_clicked with location mobile_menu when Start Free Trial is clicked", () => {
    render(<MobileMenu />);
    openMenu();
    fireEvent.click(screen.getByRole("link", { name: /start free trial/i }));
    expect(pixel.trackCustom).toHaveBeenCalledWith("cta_start_trial_clicked", { location: "mobile_menu" });
  });

  it("fires cta_manage_clicked with location mobile_menu when Manage Subscription is clicked", () => {
    render(<MobileMenu />);
    openMenu();
    fireEvent.click(screen.getByRole("link", { name: /manage subscription/i }));
    expect(pixel.trackCustom).toHaveBeenCalledWith("cta_manage_clicked", { location: "mobile_menu" });
  });
});
