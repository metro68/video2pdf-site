import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MetaPixel } from "@/app/components/MetaPixel";
import { TikTokPixel } from "@/app/components/TikTokPixel";

vi.mock("next/navigation", () => ({ usePathname: () => "/go" }));
// next/script does not render children into the DOM under jsdom, so stand in a
// plain script tag to make the generated snippet inspectable.
vi.mock("next/script", () => ({
  default: ({ children, id }: { children?: string; id?: string }) => (
    <script data-testid={id}>{children}</script>
  ),
}));

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

  it("emits one ttq.load call per comma-separated pixel id", () => {
    vi.stubEnv("NEXT_PUBLIC_TIKTOK_PIXEL_ID", "TTPIX1, TTPIX2");
    const { container } = render(<TikTokPixel />);
    const snippet = container.textContent ?? "";
    expect(snippet).toContain("ttq.load('TTPIX1');");
    expect(snippet).toContain("ttq.load('TTPIX2');");
    // A single shared ttq.page() fans out to every loaded pixel.
    expect(snippet.match(/ttq\.page\(\)/g)).toHaveLength(1);
    vi.unstubAllEnvs();
  });

  it("renders nothing when the pixel id is only whitespace or commas", () => {
    vi.stubEnv("NEXT_PUBLIC_TIKTOK_PIXEL_ID", " , ");
    const { container } = render(<TikTokPixel />);
    expect(container.firstChild).toBeNull();
    vi.unstubAllEnvs();
  });
});
