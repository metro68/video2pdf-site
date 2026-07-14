import { NextResponse } from "next/server";
import { fetchMetrics } from "@/lib/connectors/appsflyer";
import { roleFromRequest } from "@/lib/session-role";
import { redactForRole } from "@/lib/redact";

export async function GET(request: Request): Promise<NextResponse> {
  const role = await roleFromRequest(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await fetchMetrics();
  const data = result.data ? redactForRole(result.data as Record<string, unknown>, role) : null;
  return NextResponse.json({ status: result.status, asOf: result.asOf, data });
}
