import type { Campaign, Platform } from "@/lib/content/types";

// Tracking links for published posts.
//
// The /go funnel already parses a src of the shape "<channel>|c:<campaign>|a:<ad>"
// (see lib/db/channelFunnel.ts), and leads carry that src through to
// subscriptions. Reusing that convention means social posts land in the existing
// funnel-by-channel reporting with no new attribution mechanism: the channel is
// the platform, the campaign segment is the campaign, and the ad segment is the
// publication's own tracking code.

/** Stable, URL-safe per-publication code. This is what makes exact post-level
 *  attribution possible; without a unique link, only account and campaign level
 *  attribution is honest. */
export function trackingCode(publicationId: number): string {
  return `p${publicationId}`;
}

export interface TrackingLinkInput {
  campaign: Pick<Campaign, "destinationPath" | "utmCampaign">;
  platform: Platform;
  publicationId: number;
  siteUrl?: string;
}

/**
 * Builds the destination URL for one publication. The src segments mirror the
 * funnel's own convention so channelOf() and campaignOf() parse them unchanged,
 * and utm_content carries the publication code for post-level joins.
 */
export function buildTrackingLink(input: TrackingLinkInput): string {
  const base = (
    input.siteUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://www.video2pdf.ai"
  ).replace(/\/$/, "");
  const code = trackingCode(input.publicationId);
  const campaign = input.campaign.utmCampaign ?? "";

  const segments = [input.platform, campaign ? `c:${campaign}` : null, `a:${code}`]
    .filter((s): s is string => s !== null)
    .join("|");

  const path = input.campaign.destinationPath.startsWith("/")
    ? input.campaign.destinationPath
    : `/${input.campaign.destinationPath}`;

  const params = new URLSearchParams({ src: segments, utm_content: code });
  if (campaign) params.set("utm_campaign", campaign);

  return `${base}${path}?${params.toString()}`;
}
