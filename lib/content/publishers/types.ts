import type { Platform } from "@/lib/content/types";

// Publishing adapters. One per platform, behind a common interface so the
// scheduler and worker do not branch on platform.

export interface PublishInput {
  accountId: number;
  platformAccountId: string;
  accessToken: string;
  /** Publicly reachable media URL. Both Instagram and TikTok fetch the file
   *  themselves, so a private bucket key will not do: pass a signed URL with
   *  enough lifetime to cover the platform's own processing. */
  mediaUrl: string;
  caption: string;
  /** Present for carousels: one signed URL per slide. */
  slideUrls?: string[];
}

export interface PublishResult {
  platformPostId: string;
  postUrl: string | null;
}

export class ReconnectRequired extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReconnectRequired";
  }
}

export interface Publisher {
  readonly platform: Platform;
  isConfigured(): boolean;
  publishVideo(input: PublishInput): Promise<PublishResult>;
  publishCarousel(input: PublishInput): Promise<PublishResult>;
}
