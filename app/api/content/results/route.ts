import { NextResponse } from "next/server";
import { buildResults } from "@/lib/content/results";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

export async function GET(request: Request): Promise<NextResponse> {
  const raw = Number(new URL(request.url).searchParams.get("days"));
  const days =
    Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), MAX_DAYS) : DEFAULT_DAYS;
  try {
    const data = await buildResults(days);
    return NextResponse.json({ status: "ok", asOf: new Date().toISOString(), data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
