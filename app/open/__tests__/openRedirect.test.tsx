import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { OpenRedirect } from "@/app/open/OpenRedirect";

function stubLocation(search: string) {
  const replace = vi.fn();
  const original = window.location;
  Object.defineProperty(window, "location", {
    value: { ...original, search, replace },
    writable: true,
  });
  return { replace, restore: () => Object.defineProperty(window, "location", { value: original, writable: true }) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpenRedirect", () => {
  it("stamps pid=web_funnel and forwards campaign and ad ids onto the OneLink", () => {
    const { replace, restore } = stubLocation("?token=tok_1&c=aug-ugc&a=120210000001");
    render(<OpenRedirect />);
    const url = replace.mock.calls[0][0] as string;
    expect(url).toContain("pid=web_funnel");
    expect(url).toContain("c=aug-ugc");
    expect(url).toContain("af_ad=120210000001");
    expect(url).toContain("deep_link_sub1=tok_1");
    restore();
  });

  it("still stamps pid=web_funnel without a token or utm params", () => {
    const { replace, restore } = stubLocation("");
    render(<OpenRedirect />);
    const url = replace.mock.calls[0][0] as string;
    expect(url).toContain("pid=web_funnel");
    expect(url).not.toContain("af_ad=");
    restore();
  });
});
