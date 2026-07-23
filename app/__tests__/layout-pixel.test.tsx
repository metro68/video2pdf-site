import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MetaPixel } from "@/app/components/MetaPixel";

vi.mock("next/navigation", () => ({ usePathname: () => "/go" }));

describe("MetaPixel", () => {
  it("renders nothing when no pixel id is configured", () => {
    const { container } = render(<MetaPixel />);
    expect(container.firstChild).toBeNull();
  });
});
