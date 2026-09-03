import { NextResponse } from "next/server";
import { createConcept, deleteConcept, listConcepts } from "@/lib/db/content/campaigns";
import type { ContentFormat } from "@/lib/content/types";

const FORMATS: ContentFormat[] = ["reel", "carousel", "image"];

export async function GET(request: Request): Promise<NextResponse> {
  const raw = new URL(request.url).searchParams.get("campaignId");
  const campaignId = raw ? Number(raw) : undefined;
  try {
    const concepts = await listConcepts(
      Number.isInteger(campaignId) && (campaignId as number) > 0 ? campaignId : undefined,
    );
    return NextResponse.json({ status: "ok", data: { concepts } });
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
    campaignId?: number;
    hook?: string;
    angle?: string;
    structure?: string;
    format?: string;
    sourcePostId?: number;
    notes?: string;
  };

  if (!input.hook || input.hook.trim() === "") {
    return NextResponse.json({ status: "error", error: "hook is required" }, { status: 400 });
  }

  try {
    const concept = await createConcept({
      campaignId: Number.isInteger(input.campaignId) ? Number(input.campaignId) : null,
      hook: input.hook.trim(),
      angle: input.angle ?? null,
      structure: input.structure ?? null,
      format: FORMATS.includes(input.format as ContentFormat)
        ? (input.format as ContentFormat)
        : "reel",
      sourcePostId: Number.isInteger(input.sourcePostId) ? Number(input.sourcePostId) : null,
      notes: input.notes ?? null,
    });
    return NextResponse.json({ status: "ok", data: { concept } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }
  try {
    await deleteConcept(id);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
