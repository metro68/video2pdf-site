import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardTabs from "@/app/dashboard/components/DashboardTabs";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/dashboard") }));
vi.mock("next/navigation", () => ({ usePathname }));

describe("DashboardTabs", () => {
  it("shows both tabs for admins and marks the current view active", () => {
    usePathname.mockReturnValue("/dashboard/ads");
    render(<DashboardTabs isAdmin={true} />);
    expect(screen.getByText("Overview")).toBeTruthy();
    const ads = screen.getByText("Ads eval");
    expect(ads.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Overview").getAttribute("aria-current")).toBeNull();
  });

  it("hides the Ads eval tab for non-admins", () => {
    usePathname.mockReturnValue("/dashboard");
    render(<DashboardTabs isAdmin={false} />);
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.queryByText("Ads eval")).toBeNull();
  });
});
