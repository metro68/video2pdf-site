import { NextResponse } from "next/server";
import {
  createCampaign,
  listCampaigns,
  setCampaignStatus,
} from "@/lib/db/content/campaigns";
import type { CampaignStatus, ImageQuality } from "@/lib/content/types";

const QUALITIES: ImageQuality[] = ["low", "medium", "high"];
const STATUSES: CampaignStatus[] = ["draft", "active", "paused", "archived"];

export async function GET(): Promise<NextResponse> {
  try {
    const campaigns = await listCampaigns();
    return NextResponse.json({ status: "ok", data: { campaigns } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const input = body as {
    name?: string;
    objective?: string;
    audience?: string;
    cta?: string;
    destinationPath?: string;
    utmCampaign?: string;
    imageQuality?: string;
    budgetDollars?: unknown;
  };

  if (!input.name || input.name.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "name is required" },
      { status: 400 },
    );
  }

  // Budget is entered in dollars and stored in cents, so a typo in the form
  // cannot silently become a 100x larger cap.
  const dollars = Number(input.budgetDollars);
  const imageBudgetCents =
    input.budgetDollars === "" || input.budgetDollars == null || !Number.isFinite(dollars)
      ? null
      : Math.round(dollars * 100);

  try {
    const campaign = await createCampaign({
      name: input.name.trim(),
      objective: input.objective ?? null,
      audience: input.audience ?? null,
      cta: input.cta ?? null,
      destinationPath: input.destinationPath || "/go",
      utmCampaign: input.utmCampaign ?? null,
      imageQuality: QUALITIES.includes(input.imageQuality as ImageQuality)
        ? (input.imageQuality as ImageQuality)
        : "low",
      imageBudgetCents,
    });
    return NextResponse.json({ status: "ok", data: { campaign } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }
  const input = body as { id?: number; status?: string };
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }
  if (!STATUSES.includes(input.status as CampaignStatus)) {
    return NextResponse.json(
      { status: "error", error: "status must be draft, active, paused or archived" },
      { status: 400 },
    );
  }
  try {
    await setCampaignStatus(id, input.status as CampaignStatus);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
