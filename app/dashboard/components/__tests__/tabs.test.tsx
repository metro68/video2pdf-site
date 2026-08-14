import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardTabs from "@/app/dashboard/components/DashboardTabs";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/dashboard") }));
vi.mock("next/navigation", () => ({ usePathname }));

describe("DashboardTabs", () => {
  it("shows both tabs and marks the current view active", () => {
    usePathname.mockReturnValue("/dashboard/ads");
    render(<DashboardTabs />);
    expect(screen.getByText("Overview")).toBeTruthy();
    const ads = screen.getByText("Ads eval");
    expect(ads.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Overview").getAttribute("aria-current")).toBeNull();
  });

  it("marks Overview active on the main dashboard", () => {
    usePathname.mockReturnValue("/dashboard");
    render(<DashboardTabs />);
    expect(screen.getByText("Overview").getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Ads eval").getAttribute("aria-current")).toBeNull();
  });
});
