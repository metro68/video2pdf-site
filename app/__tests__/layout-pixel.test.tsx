import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MetaPixel } from "@/app/components/MetaPixel";
import { TikTokPixel } from "@/app/components/TikTokPixel";

vi.mock("next/navigation", () => ({ usePathname: () => "/go" }));

describe("MetaPixel", () => {
  it("renders nothing when no pixel id is configured", () => {
    const { container } = render(<MetaPixel />);
    expect(container.firstChild).toBeNull();
  });
});

describe("TikTokPixel", () => {
  it("renders nothing when no pixel id is configured", () => {
    const { container } = render(<TikTokPixel />);
    expect(container.firstChild).toBeNull();
  });

  it("does not fire a route-change pageview on first render", () => {
    const page = vi.fn();
    (globalThis as any).ttq = { page };
    vi.stubEnv("NEXT_PUBLIC_TIKTOK_PIXEL_ID", "TTPIX1");
    render(<TikTokPixel />);
    // The base snippet owns the initial ttq.page(); the effect must not add a second.
    expect(page).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    (globalThis as any).ttq = undefined;
  });
});
