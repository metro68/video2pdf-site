import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import DashboardClient from "@/app/dashboard/components/DashboardClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard",
}));

// DashboardClient fires one fetch per metric route on mount. This mock answers
// every route with an empty-but-ok payload, and lets each test override just
// the /api/metrics/cost response to exercise the scan-cost tiles.
function mockRoutes(costData: Record<string, number> | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      let body: unknown = { status: "ok", asOf: null, data: null };
      if (url.startsWith("/api/metrics/cost")) {
        body = { status: "ok", asOf: null, data: costData };
      } else if (url.startsWith("/api/metrics/channels")) {
        body = { status: "ok", asOf: null, data: { channels: [] } };
      } else if (url.startsWith("/api/metrics/downloads-sources")) {
        body = { status: "awaiting_credentials", asOf: null, data: null };
      }
      return Promise.resolve({ json: () => Promise.resolve(body) } as Response);
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DashboardClient scan-cost tiles", () => {
  it("shows model spend and cost per scan once cost events land", async () => {
    mockRoutes({ scans: 10, modelSpendUsd: 3, costPerScanUsd: 0.3 });
    render(<DashboardClient role="admin" />);
    await waitFor(() => expect(screen.getByText("Model cost / scan")).toBeInTheDocument());
    expect(screen.getByText("$0.3000")).toBeInTheDocument();
    expect(screen.getByText("$3.00")).toBeInTheDocument();
  });

  it("shows n/a while the scan server reports no cost", async () => {
    mockRoutes({ scans: 16 });
    render(<DashboardClient role="admin" />);
    await waitFor(() => expect(screen.getByText("Model cost / scan")).toBeInTheDocument());
    // Two cost tiles, both unmeasured, so at least two n/a values are present.
    expect(screen.getAllByText("n/a").length).toBeGreaterThanOrEqual(2);
  });
});
