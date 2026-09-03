import type { Platform } from "@/lib/content/types";
import type { Publisher } from "./types";
import { instagramPublisher } from "./instagram";
import { tiktokPublisher } from "./tiktok";

export function publisherFor(platform: Platform): Publisher {
  return platform === "instagram" ? instagramPublisher : tiktokPublisher;
}

export { ReconnectRequired } from "./types";
export type { Publisher, PublishInput, PublishResult } from "./types";
