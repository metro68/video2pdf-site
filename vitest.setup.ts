import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one to
// mount. A no-op stub is enough for tests, which don't assert on layout.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
