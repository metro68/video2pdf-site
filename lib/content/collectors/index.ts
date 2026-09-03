import type { PublicCollector } from "./types";
import { manualCollector } from "./manual";

// Single place that decides which collector is active. When a licensed provider
// or Business Discovery is approved, implement PublicCollector and select it
// here; every caller keeps working unchanged.
export function activeCollector(): PublicCollector {
  return manualCollector;
}

export type { PublicCollector, PublicPost, PublicProfile } from "./types";
