import { NextResponse } from "next/server";
import { fetchTotalDownloads } from "@/lib/downloads-total";
import { roleFromRequest } from "@/lib/session-role";

export async function GET(request: Request): Promise<NextResponse> {
  const role = await roleFromRequest(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await fetchTotalDownloads();
  return NextResponse.json({ status: result.status, asOf: result.asOf, data: result.data });
}
