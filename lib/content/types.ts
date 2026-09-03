// Domain types for the UGC content engine.
// Spec: docs/superpowers/specs/2026-09-03-ugc-content-engine-design.md

export type Platform = "instagram" | "tiktok";
export type AccountKind = "owned" | "watched";
export type MediaType = "reel" | "video" | "image" | "carousel" | "unknown";
export type ContentFormat = "reel" | "carousel" | "image";
export type ImageQuality = "low" | "medium" | "high";

export type CampaignStatus = "draft" | "active" | "paused" | "archived";
export type VariantStatus =
  | "draft"
  | "generating"
  | "needs_review"
  | "approved"
  | "rejected"
  | "failed";
export type JobKind =
  | "concept"
  | "script"
  | "images"
  | "render"
  | "publish"
  | "sync_metrics"
  | "collect_public";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type PublicationStatus =
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "canceled"
  | "exported";

// Where a metric came from and how much to trust it. Every public figure the
// dashboard renders carries one of these, so a manually entered like count is
// never presented as though it came from an Insights API.
export type MetricSource =
  | "manual"
  | "business_discovery"
  | "licensed"
  | "instagram_insights"
  | "tiktok_api";

export interface SourceMeta {
  source: MetricSource;
  collectedAt: number;
  /** False when the platform does not expose this field publicly at all,
   *  which is different from "we have not collected it yet". */
  available: boolean;
}

export interface SocialAccount {
  id: number;
  platform: Platform;
  kind: AccountKind;
  handle: string;
  displayName: string | null;
  platformAccountId: string | null;
  angle: string | null;
  needsReconnect: boolean;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AccountSnapshot {
  id: number;
  accountId: number;
  followers: number | null;
  following: number | null;
  postCount: number | null;
  source: MetricSource;
  collectedAt: number;
}

export interface PostSnapshot {
  id: number;
  accountId: number;
  platformPostId: string;
  postUrl: string | null;
  caption: string | null;
  mediaType: MediaType | null;
  publishedAt: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  source: MetricSource;
  collectedAt: number;
}

export interface Campaign {
  id: number;
  name: string;
  objective: string | null;
  audience: string | null;
  cta: string | null;
  destinationPath: string;
  utmCampaign: string | null;
  imageQuality: ImageQuality;
  imageBudgetCents: number | null;
  spentCents: number;
  status: CampaignStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Concept {
  id: number;
  campaignId: number | null;
  hook: string;
  angle: string | null;
  structure: string | null;
  format: ContentFormat;
  sourcePostId: number | null;
  notes: string | null;
  createdAt: number;
}

export interface QualityCheck {
  check: string;
  passed: boolean;
  detail?: string;
}

export interface Variant {
  id: number;
  conceptId: number;
  accountId: number | null;
  script: string | null;
  caption: string | null;
  hashtags: string | null;
  renderKey: string | null;
  assetKeys: string[];
  status: VariantStatus;
  rejectReason: string | null;
  qualityChecks: QualityCheck[];
  approvedBy: string | null;
  approvedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface GenerationJob {
  id: number;
  kind: JobKind;
  variantId: number | null;
  campaignId: number | null;
  accountId: number | null;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  idempotencyKey: string | null;
  claimedBy: string | null;
  claimedAt: number | null;
  runAfter: number;
  costCents: number;
  createdAt: number;
  updatedAt: number;
}

export interface Publication {
  id: number;
  variantId: number;
  accountId: number;
  scheduledFor: number | null;
  publishedAt: number | null;
  platformPostId: string | null;
  postUrl: string | null;
  trackingCode: string | null;
  status: PublicationStatus;
  attempts: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PublicationMetric {
  id: number;
  publicationId: number;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  follows: number | null;
  profileVisits: number | null;
  watchTimeSeconds: number | null;
  source: MetricSource;
  collectedAt: number;
}
