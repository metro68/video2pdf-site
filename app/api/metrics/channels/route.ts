import { NextResponse } from "next/server";
import { fetchChannelFunnel } from "@/lib/db/channelFunnel";
import { roleFromRequest } from "@/lib/session-role";

export async function GET(request: Request): Promise<NextResponse> {
  const role = await roleFromRequest(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  try {
    const channels = await fetchChannelFunnel(month);
    return NextResponse.json({
      status: "ok",
      asOf: new Date().toISOString(),
      data: { channels },
    });
  } catch (e) {
    return NextResponse.json({
      status: "error",
      asOf: null,
      data: null,
      error: (e as Error).message,
    });
  }
}
