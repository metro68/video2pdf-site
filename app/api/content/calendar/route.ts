import { NextResponse } from "next/server";
import {
  cancelPublication,
  listCalendar,
  schedulePublication,
} from "@/lib/db/content/publications";
import { getVariant } from "@/lib/db/content/variants";

export async function GET(): Promise<NextResponse> {
  try {
    const publications = await listCalendar();
    return NextResponse.json({ status: "ok", data: { publications } });
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

  const input = body as { variantId?: number; accountId?: number; scheduledFor?: string };
  const variantId = Number(input.variantId);
  const accountId = Number(input.accountId);
  if (!Number.isInteger(variantId) || !Number.isInteger(accountId)) {
    return NextResponse.json(
      { status: "error", error: "variantId and accountId are required" },
      { status: 400 },
    );
  }

  // Only approved variants can be scheduled. This is the second half of the
  // human gate: approval in Review, and nothing unapproved reaching a schedule.
  const variant = await getVariant(variantId);
  if (!variant) {
    return NextResponse.json({ status: "error", error: "variant not found" }, { status: 404 });
  }
  if (variant.status !== "approved") {
    return NextResponse.json(
      { status: "error", error: "only approved variants can be scheduled" },
      { status: 400 },
    );
  }

  const when = input.scheduledFor ? new Date(input.scheduledFor) : null;
  if (when && Number.isNaN(when.getTime())) {
    return NextResponse.json(
      { status: "error", error: "scheduledFor is not a valid date" },
      { status: 400 },
    );
  }

  try {
    const publication = await schedulePublication(variantId, accountId, when);
    return NextResponse.json({ status: "ok", data: { publication } });
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
    await cancelPublication(id);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
