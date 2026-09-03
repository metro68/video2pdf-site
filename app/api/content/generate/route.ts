import { NextResponse } from "next/server";
import { createVariant } from "@/lib/db/content/variants";
import { enqueueJob } from "@/lib/db/content/jobs";
import { getCampaign, hasBudgetFor } from "@/lib/db/content/campaigns";
import { imageCostCents } from "@/lib/content/providers/openai";

// Enqueues generation for one concept across the chosen accounts.
//
// This route only enqueues. Generation and rendering run on the worker: a
// render is minutes of CPU and needs FFmpeg, neither of which belongs in a
// request-time Vercel function.
//
// One variant per account, each with its own script and its own generated
// media. Accounts never share rendered assets, which is what keeps a cluster
// of our accounts out of duplicate-content suppression.

const ESTIMATED_SCENES = 6;

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const input = body as { conceptId?: number; accountIds?: number[]; campaignId?: number };
  const conceptId = Number(input.conceptId);
  if (!Number.isInteger(conceptId) || conceptId <= 0) {
    return NextResponse.json(
      { status: "error", error: "conceptId is required" },
      { status: 400 },
    );
  }

  const accountIds = Array.isArray(input.accountIds)
    ? input.accountIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  if (accountIds.length === 0) {
    return NextResponse.json(
      { status: "error", error: "at least one accountId is required" },
      { status: 400 },
    );
  }

  // Budget is checked here as well as in the worker. This one gives the operator
  // an immediate, actionable error; the worker's check is the one that actually
  // prevents spending, since it runs at the moment of the call.
  const campaignId = Number(input.campaignId);
  if (Number.isInteger(campaignId) && campaignId > 0) {
    const campaign = await getCampaign(campaignId);
    if (campaign) {
      const estimate = imageCostCents(
        campaign.imageQuality,
        ESTIMATED_SCENES * accountIds.length,
      );
      if (!(await hasBudgetFor(campaignId, estimate))) {
        return NextResponse.json(
          {
            status: "error",
            error:
              `This run would cost about $${(estimate / 100).toFixed(2)} and the ` +
              `campaign has $${((campaign.imageBudgetCents ?? 0) - campaign.spentCents) / 100} left.`,
          },
          { status: 400 },
        );
      }
    }
  }

  try {
    const queued: Array<{ variantId: number; accountId: number }> = [];

    for (const accountId of accountIds) {
      const variant = await createVariant(conceptId, accountId);
      // The script job is enqueued now; the images job is enqueued by the
      // worker once a script exists, so image spend never happens for a variant
      // whose script failed or was rejected.
      await enqueueJob({
        kind: "script",
        variantId: variant.id,
        campaignId: Number.isInteger(campaignId) ? campaignId : null,
        accountId,
        idempotencyKey: `script:${variant.id}`,
      });
      queued.push({ variantId: variant.id, accountId });
    }

    return NextResponse.json({ status: "ok", data: { queued } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
