import { NextResponse } from "next/server";
import { loadManagedSubscription } from "@/lib/manage/auth";
import { applyAnnualWinback, applyWeeklyPause } from "@/lib/manage/stripeOps";
import { insertCancellationEvent } from "@/lib/db/cancellationEvents";
import { MANAGE_CONFIG } from "@/lib/manage/config";

export async function POST(request: Request): Promise<NextResponse> {
  const { token } = await request.json().catch(() => ({}));
  const managed = await loadManagedSubscription(token);
  if (!managed) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
  const { email, sub, overview } = managed;
  if (!overview.offerAvailable) {
    return NextResponse.json({ error: "Offer not available" }, { status: 409 });
  }

  try {
    let outcome: "saved_offer" | "paused";
    if (overview.plan === "annual") {
      await applyAnnualWinback(sub.id);
      outcome = "saved_offer";
    } else {
      const resumesAt =
        Math.floor(Date.now() / 1000) + MANAGE_CONFIG.pauseDays * 24 * 60 * 60;
      await applyWeeklyPause(sub.id, resumesAt);
      outcome = "paused";
    }
    // Feedback write must never block the save.
    await insertCancellationEvent({
      email,
      plan: overview.plan,
      stepReached: "offer",
      outcome,
    }).catch(() => {});
    return NextResponse.json({ ok: true, outcome });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
