import { NextResponse } from "next/server";
import { buildTrends } from "@/lib/content/trends";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;

export async function GET(request: Request): Promise<NextResponse> {
  const raw = Number(new URL(request.url).searchParams.get("days"));
  const windowDays =
    Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), MAX_WINDOW_DAYS) : DEFAULT_WINDOW_DAYS;

  try {
    const data = await buildTrends(windowDays);
    return NextResponse.json({ status: "ok", asOf: new Date().toISOString(), data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
