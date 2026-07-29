import { NextResponse } from "next/server";
import { loadManagedSubscription } from "@/lib/manage/auth";
import { setCancelAtPeriodEnd } from "@/lib/manage/stripeOps";
import { insertCancellationEvent } from "@/lib/db/cancellationEvents";

export async function POST(request: Request): Promise<NextResponse> {
  const { token } = await request.json().catch(() => ({}));
  const managed = await loadManagedSubscription(token);
  if (!managed) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
  try {
    await setCancelAtPeriodEnd(managed.sub.id, false);
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
  await insertCancellationEvent({
    email: managed.email,
    plan: managed.overview.plan,
    stepReached: "confirm",
    outcome: "resumed",
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
