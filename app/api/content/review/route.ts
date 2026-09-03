import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { getVariant, listForReview, setVariantStatus } from "@/lib/db/content/variants";
import { enqueueJob } from "@/lib/db/content/jobs";

// The approval queue. Nothing publishes without passing through here.

export async function GET(): Promise<NextResponse> {
  try {
    const variants = await listForReview();
    return NextResponse.json({ status: "ok", data: { variants } });
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

  const input = body as { ids?: number[]; action?: string; reason?: string };
  const ids = Array.isArray(input.ids)
    ? input.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ status: "error", error: "ids are required" }, { status: 400 });
  }

  // Approval is attributed to the logged-in operator, so the record shows who
  // signed off on each post rather than just that something did.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const approver = session?.email ?? null;

  // Each id is handled independently: one failure must not discard the
  // decisions already applied to the rest of a batch.
  const succeeded: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];

  for (const id of ids) {
    try {
      if (input.action === "approve") {
        const variant = await getVariant(id);
        if (!variant) throw new Error("not found");
        if (variant.renderKey == null && variant.assetKeys.length === 0) {
          throw new Error("nothing generated yet");
        }
        await setVariantStatus(id, "approved", { approvedBy: approver });
      } else if (input.action === "reject") {
        await setVariantStatus(id, "rejected", { rejectReason: input.reason ?? null });
      } else if (input.action === "regenerate") {
        await setVariantStatus(id, "generating");
        // Attempt-scoped key so a regenerate after a previous run is a new job
        // rather than a no-op against the earlier idempotency key.
        await enqueueJob({
          kind: "script",
          variantId: id,
          idempotencyKey: `script:${id}:${Date.now()}`,
        });
      } else {
        throw new Error("action must be approve, reject or regenerate");
      }
      succeeded.push(id);
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : "unknown error" });
    }
  }

  return NextResponse.json({ status: "ok", data: { succeeded, failed } });
}
