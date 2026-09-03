import type { ConnectorResult } from "@/lib/connectors/types";
import type { MediaType, MetricSource, Platform } from "@/lib/content/types";

// The public-data collector sits behind this interface because how we collect
// public metrics is expected to change, and campaign logic must not change with
// it. Three implementations are anticipated:
//
//   manual              operator pastes a URL or uploads a CSV (shipping now)
//   business_discovery  Instagram's Business Discovery endpoint, which needs our
//                       own IG Professional account plus app review
//   licensed            a paid data provider
//
// Instagram's owned-account Insights API cannot read accounts we do not own, so
// none of this pretends to be Insights data. Every field carries its source.

export interface PublicProfile {
  handle: string;
  platform: Platform;
  displayName: string | null;
  followers: number | null;
  following: number | null;
  postCount: number | null;
  source: MetricSource;
  collectedAt: number;
}

export interface PublicPost {
  platformPostId: string;
  postUrl: string | null;
  caption: string | null;
  mediaType: MediaType | null;
  publishedAt: number | null;
  /** Null where the platform does not show a public view count. */
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  source: MetricSource;
  collectedAt: number;
}

export interface PublicCollector {
  /** Stable identifier recorded on every snapshot this collector produces. */
  readonly source: MetricSource;
  /** Human-readable name for the dashboard's provenance labels. */
  readonly label: string;
  /** False when the collector needs credentials or approval it does not have. */
  isConfigured(): boolean;
  fetchProfile(
    platform: Platform,
    handle: string,
  ): Promise<ConnectorResult<PublicProfile>>;
  fetchRecentPosts(
    platform: Platform,
    handle: string,
  ): Promise<ConnectorResult<PublicPost[]>>;
}
