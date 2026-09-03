import type {
  AccountKind,
  AccountSnapshot,
  Campaign,
  CampaignStatus,
  Concept,
  ContentFormat,
  GenerationJob,
  ImageQuality,
  JobKind,
  JobStatus,
  MediaType,
  MetricSource,
  Platform,
  PostSnapshot,
  Publication,
  PublicationMetric,
  PublicationStatus,
  QualityCheck,
  SocialAccount,
  Variant,
  VariantStatus,
} from "@/lib/content/types";

// Row mappers for the content-engine tables, mirroring the snake_case to
// camelCase convention already used by lib/db/client.ts. Timestamps become
// epoch ms so client components can format them without a date library.

type Row = Record<string, unknown>;

const ms = (v: unknown): number | null =>
  v == null ? null : v instanceof Date ? v.getTime() : Date.parse(String(v));

const num = (v: unknown): number | null =>
  v == null ? null : Number(v);

const str = (v: unknown): string | null => (v == null ? null : String(v));

// JSONB columns arrive already parsed from pg, but a text fallback keeps the
// mappers safe if a column is ever read through a driver that does not.
function jsonb<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

export function mapSocialAccount(r: Row): SocialAccount {
  return {
    id: Number(r.id),
    platform: r.platform as Platform,
    kind: r.kind as AccountKind,
    handle: String(r.handle),
    displayName: str(r.display_name),
    platformAccountId: str(r.platform_account_id),
    angle: str(r.angle),
    needsReconnect: Boolean(r.needs_reconnect),
    active: Boolean(r.active),
    createdAt: ms(r.created_at) ?? 0,
    updatedAt: ms(r.updated_at) ?? 0,
  };
}

export function mapAccountSnapshot(r: Row): AccountSnapshot {
  return {
    id: Number(r.id),
    accountId: Number(r.account_id),
    followers: num(r.followers),
    following: num(r.following),
    postCount: num(r.post_count),
    source: r.source as MetricSource,
    collectedAt: ms(r.collected_at) ?? 0,
  };
}

export function mapPostSnapshot(r: Row): PostSnapshot {
  return {
    id: Number(r.id),
    accountId: Number(r.account_id),
    platformPostId: String(r.platform_post_id),
    postUrl: str(r.post_url),
    caption: str(r.caption),
    mediaType: (r.media_type as MediaType) ?? null,
    publishedAt: ms(r.published_at),
    views: num(r.views),
    likes: num(r.likes),
    comments: num(r.comments),
    shares: num(r.shares),
    source: r.source as MetricSource,
    collectedAt: ms(r.collected_at) ?? 0,
  };
}

export function mapCampaign(r: Row): Campaign {
  return {
    id: Number(r.id),
    name: String(r.name),
    objective: str(r.objective),
    audience: str(r.audience),
    cta: str(r.cta),
    destinationPath: String(r.destination_path),
    utmCampaign: str(r.utm_campaign),
    imageQuality: r.image_quality as ImageQuality,
    imageBudgetCents: num(r.image_budget_cents),
    spentCents: Number(r.spent_cents ?? 0),
    status: r.status as CampaignStatus,
    createdAt: ms(r.created_at) ?? 0,
    updatedAt: ms(r.updated_at) ?? 0,
  };
}

export function mapConcept(r: Row): Concept {
  return {
    id: Number(r.id),
    campaignId: num(r.campaign_id),
    hook: String(r.hook),
    angle: str(r.angle),
    structure: str(r.structure),
    format: r.format as ContentFormat,
    sourcePostId: num(r.source_post_id),
    notes: str(r.notes),
    createdAt: ms(r.created_at) ?? 0,
  };
}

export function mapVariant(r: Row): Variant {
  return {
    id: Number(r.id),
    conceptId: Number(r.concept_id),
    accountId: num(r.account_id),
    script: str(r.script),
    caption: str(r.caption),
    hashtags: str(r.hashtags),
    renderKey: str(r.render_key),
    assetKeys: jsonb<string[]>(r.asset_keys, []),
    status: r.status as VariantStatus,
    rejectReason: str(r.reject_reason),
    qualityChecks: jsonb<QualityCheck[]>(r.quality_checks, []),
    approvedBy: str(r.approved_by),
    approvedAt: ms(r.approved_at),
    createdAt: ms(r.created_at) ?? 0,
    updatedAt: ms(r.updated_at) ?? 0,
  };
}

export function mapGenerationJob(r: Row): GenerationJob {
  return {
    id: Number(r.id),
    kind: r.kind as JobKind,
    variantId: num(r.variant_id),
    campaignId: num(r.campaign_id),
    accountId: num(r.account_id),
    payload: jsonb<Record<string, unknown>>(r.payload, {}),
    status: r.status as JobStatus,
    attempts: Number(r.attempts ?? 0),
    maxAttempts: Number(r.max_attempts ?? 3),
    lastError: str(r.last_error),
    idempotencyKey: str(r.idempotency_key),
    claimedBy: str(r.claimed_by),
    claimedAt: ms(r.claimed_at),
    runAfter: ms(r.run_after) ?? 0,
    costCents: Number(r.cost_cents ?? 0),
    createdAt: ms(r.created_at) ?? 0,
    updatedAt: ms(r.updated_at) ?? 0,
  };
}

export function mapPublication(r: Row): Publication {
  return {
    id: Number(r.id),
    variantId: Number(r.variant_id),
    accountId: Number(r.account_id),
    scheduledFor: ms(r.scheduled_for),
    publishedAt: ms(r.published_at),
    platformPostId: str(r.platform_post_id),
    postUrl: str(r.post_url),
    trackingCode: str(r.tracking_code),
    status: r.status as PublicationStatus,
    attempts: Number(r.attempts ?? 0),
    lastError: str(r.last_error),
    createdAt: ms(r.created_at) ?? 0,
    updatedAt: ms(r.updated_at) ?? 0,
  };
}

export function mapPublicationMetric(r: Row): PublicationMetric {
  return {
    id: Number(r.id),
    publicationId: Number(r.publication_id),
    views: num(r.views),
    reach: num(r.reach),
    likes: num(r.likes),
    comments: num(r.comments),
    shares: num(r.shares),
    saves: num(r.saves),
    follows: num(r.follows),
    profileVisits: num(r.profile_visits),
    watchTimeSeconds: num(r.watch_time_seconds),
    source: r.source as MetricSource,
    collectedAt: ms(r.collected_at) ?? 0,
  };
}
