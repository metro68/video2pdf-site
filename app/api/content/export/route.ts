import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getVariant } from "@/lib/db/content/variants";
import { getCampaign } from "@/lib/db/content/campaigns";
import { buildPostPackage } from "@/lib/content/export";
import { buildTrackingLink } from "@/lib/content/attribution";
import { signedUrl, isConfigured } from "@/lib/content/storage";

// Returns everything needed to publish a variant by hand. This is the path that
// works before Instagram and TikTok app review, so the pipeline is fully usable
// without waiting on either platform.

export async function GET(request: Request): Promise<NextResponse> {
  const variantId = Number(new URL(request.url).searchParams.get("variantId"));
  if (!Number.isInteger(variantId) || variantId <= 0) {
    return NextResponse.json(
      { status: "error", error: "variantId is required" },
      { status: 400 },
    );
  }

  try {
    const variant = await getVariant(variantId);
    if (!variant) {
      return NextResponse.json({ status: "error", error: "not found" }, { status: 404 });
    }

    const meta = await sql<{
      hook: string;
      campaign_id: number | null;
      handle: string | null;
      platform: string | null;
      publication_id: number | null;
    }>`
      SELECT c.hook, c.campaign_id, a.handle, a.platform, p.id AS publication_id
      FROM variants v
      JOIN concepts c ON c.id = v.concept_id
      LEFT JOIN social_accounts a ON a.id = v.account_id
      LEFT JOIN publications p ON p.variant_id = v.id AND p.account_id = v.account_id
      WHERE v.id = ${variantId}
    `;
    const row = meta.rows[0];

    // A tracking link only exists once there is a publication to key it to.
    // Without one, attribution is honestly account level, and the package says so.
    let trackingLink: string | null = null;
    if (row?.publication_id && row.campaign_id) {
      const campaign = await getCampaign(row.campaign_id);
      if (campaign && row.platform) {
        trackingLink = buildTrackingLink({
          campaign,
          platform: row.platform as "instagram" | "tiktok",
          publicationId: row.publication_id,
        });
      }
    }

    const pkg = buildPostPackage(variant, {
      hook: row?.hook ?? "",
      account: row?.handle ?? null,
      platform: row?.platform ?? null,
      trackingLink,
    });

    // Signed URLs so the operator can download the media directly.
    const assetUrls: string[] = [];
    if (isConfigured()) {
      for (const key of [...(variant.renderKey ? [variant.renderKey] : []), ...variant.assetKeys]) {
        try {
          assetUrls.push(await signedUrl(key));
        } catch {
          // A missing object should not fail the whole package: the operator
          // still gets the caption, link and the assets that do exist.
        }
      }
    }

    return NextResponse.json({ status: "ok", data: { package: pkg, assetUrls } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
