import { NextResponse } from "next/server";
import { loadManagedSubscription } from "@/lib/manage/auth";
import {
  insertCancellationEvent,
  type CancelOutcome,
  type CancelStep,
} from "@/lib/db/cancellationEvents";

const STEPS: ReadonlySet<string> = new Set(["survey", "loss", "offer", "confirm"]);
const OUTCOMES: ReadonlySet<string> = new Set([
  "saved_offer",
  "paused",
  "canceled",
  "resumed",
  "abandoned_kept",
]);

export async function POST(request: Request): Promise<NextResponse> {
  const { token, reason, comment, stepReached, outcome } = await request
    .json()
    .catch(() => ({}));
  const managed = await loadManagedSubscription(token);
  if (!managed) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
  if (typeof stepReached !== "string" || !STEPS.has(stepReached)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }
  const validOutcome =
    typeof outcome === "string" && OUTCOMES.has(outcome)
      ? (outcome as CancelOutcome)
      : null;
  await insertCancellationEvent({
    email: managed.email,
    plan: managed.overview.plan,
    reason: typeof reason === "string" ? reason : null,
    comment: typeof comment === "string" ? comment : null,
    stepReached: stepReached as CancelStep,
    outcome: validOutcome,
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
