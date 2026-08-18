import { NextResponse } from "next/server";
import { fetchAdReport } from "@/lib/connectors/tiktok";
import { roleFromRequest } from "@/lib/session-role";

export async function GET(request: Request): Promise<NextResponse> {
  const role = await roleFromRequest(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = Number(new URL(request.url).searchParams.get("days"));
  const days = Number.isFinite(raw) && raw > 0 ? Math.min(90, Math.floor(raw)) : 14;
  const result = await fetchAdReport(days);
  return NextResponse.json({ status: result.status, asOf: result.asOf, data: result.data });
}
