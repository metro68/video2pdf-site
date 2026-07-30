import { NextResponse } from "next/server";
import { loadManagedSubscription } from "@/lib/manage/auth";
import {
  applyAnnualWinback,
  applyWeeklyPause,
  deferAnnualWinback,
  setCancelAtPeriodEnd,
} from "@/lib/manage/stripeOps";
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
    // A subscription already scheduled to cancel must be un-scheduled before the
    // offer is applied, otherwise the coupon or pause is burned while the
    // subscription still terminates at period end.
    if (sub.cancel_at_period_end) {
      await setCancelAtPeriodEnd(sub.id, false);
    }
    let outcome: "saved_offer" | "paused";
    if (overview.plan === "annual") {
      if (overview.trialing) {
        // During the trial the next invoice is the $29.99 conversion charge,
        // which must bill at full price. Defer the coupon; the invoice.paid
        // webhook applies it after that charge, discounting year 2 instead.
        await deferAnnualWinback(sub.id);
      } else {
        await applyAnnualWinback(sub.id);
      }
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
