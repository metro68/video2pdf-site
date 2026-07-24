import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FreshnessLine from "@/app/dashboard/components/FreshnessLine";

describe("FreshnessLine", () => {
  it("shows an up to date label for status ok", () => {
    render(<FreshnessLine asOf="2026-07-20T00:00:00.000Z" source="App Store" status="ok" />);
    expect(screen.getByText(/up to date/i)).toBeInTheDocument();
    expect(screen.getByText(/App Store/)).toBeInTheDocument();
  });

  it("shows a not connected label for status awaiting_credentials", () => {
    render(<FreshnessLine asOf={null} source="Stripe" status="awaiting_credentials" />);
    expect(screen.getByText(/not connected/i)).toBeInTheDocument();
  });

  it("shows an error label for status error", () => {
    render(<FreshnessLine asOf={null} source="PostHog" status="error" />);
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it("renders without a status label when status is omitted", () => {
    render(<FreshnessLine asOf={null} source="Meta" />);
    expect(screen.getByText(/Meta/)).toBeInTheDocument();
    expect(screen.queryByText(/up to date/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not connected/i)).not.toBeInTheDocument();
  });
});
