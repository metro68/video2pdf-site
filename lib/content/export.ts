import type { Variant } from "@/lib/content/types";

// Post package export: everything needed to publish a variant by hand.
//
// This is what makes M4 useful before any platform approval exists. An operator
// gets the caption, hashtags, tracking link and asset list, publishes manually,
// and the publication is recorded as "exported" so Results still counts it.

export interface PostPackage {
  variantId: number;
  hook: string;
  account: string | null;
  platform: string | null;
  caption: string;
  hashtags: string[];
  trackingLink: string | null;
  assetKeys: string[];
  renderKey: string | null;
  /** Plain-text version an operator can paste straight into the app. */
  readme: string;
}

export function buildPostPackage(
  variant: Variant,
  context: {
    hook: string;
    account: string | null;
    platform: string | null;
    trackingLink: string | null;
  },
): PostPackage {
  const hashtags = (variant.hashtags ?? "")
    .split(/\s+/)
    .map((h) => h.replace(/^#/, ""))
    .filter((h) => h.length > 0);

  const caption = variant.caption ?? "";

  const readme = [
    `Post package for variant ${variant.id}`,
    context.account ? `Account: @${context.account} (${context.platform ?? "unknown"})` : null,
    `Concept: ${context.hook}`,
    "",
    "Caption:",
    caption,
    "",
    hashtags.length ? `Hashtags: ${hashtags.map((h) => `#${h}`).join(" ")}` : null,
    context.trackingLink ? `Link: ${context.trackingLink}` : null,
    "",
    variant.renderKey ? `Video: ${variant.renderKey}` : null,
    variant.assetKeys.length ? `Stills: ${variant.assetKeys.length} file(s)` : null,
    "",
    context.trackingLink
      ? "Use the link above so this post's conversions can be attributed to it."
      : "No unique link: conversions from this post can only be attributed at account level.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return {
    variantId: variant.id,
    hook: context.hook,
    account: context.account,
    platform: context.platform,
    caption,
    hashtags,
    trackingLink: context.trackingLink,
    assetKeys: variant.assetKeys,
    renderKey: variant.renderKey,
    readme,
  };
}
