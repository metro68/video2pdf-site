import { NextResponse } from "next/server";
import { roleFromRequest } from "@/lib/session-role";
import { fetchAdInsights } from "@/lib/connectors/meta";
import { fetchTrialCohort } from "@/lib/connectors/stripe";
import { assemblePayload } from "@/lib/ads/assemble";

const ALLOWED_DAYS = [7, 14, 30];

export async function GET(request: Request): Promise<NextResponse> {
  const role = await roleFromRequest(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = Number(new URL(request.url).searchParams.get("days") ?? 14);
  const windowDays = ALLOWED_DAYS.includes(raw) ? raw : 30;

  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - (windowDays - 1) * 864e5).toISOString().slice(0, 10);

  const [meta, cohort] = await Promise.all([fetchAdInsights(), fetchTrialCohort(from, to)]);

  const payload = assemblePayload({
    adRows: meta.data,
    cohort: cohort.data,
    windowDays,
    now,
    metaError: meta.status === "ok" ? undefined : (meta.error ?? meta.status),
    stripeError: cohort.status === "ok" ? undefined : (cohort.error ?? cohort.status),
  });

  return NextResponse.json(payload);
}
