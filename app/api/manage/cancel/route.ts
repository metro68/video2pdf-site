import { NextResponse } from "next/server";
import { loadManagedSubscription } from "@/lib/manage/auth";
import { setCancelAtPeriodEnd } from "@/lib/manage/stripeOps";
import { insertCancellationEvent } from "@/lib/db/cancellationEvents";

export async function POST(request: Request): Promise<NextResponse> {
  const { token, reason, comment } = await request.json().catch(() => ({}));
  const managed = await loadManagedSubscription(token);
  if (!managed) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
  const { email, sub, overview } = managed;

  try {
    await setCancelAtPeriodEnd(sub.id, true);
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
  await insertCancellationEvent({
    email,
    plan: overview.plan,
    reason: typeof reason === "string" ? reason : null,
    comment: typeof comment === "string" ? comment : null,
    stepReached: "confirm",
    outcome: "canceled",
  }).catch(() => {});
  return NextResponse.json({ ok: true, endsAt: overview.currentPeriodEnd });
}
