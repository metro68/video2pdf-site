import { NextResponse } from "next/server";
import { cancelJob, listJobs, retryJob } from "@/lib/db/content/jobs";

export async function GET(): Promise<NextResponse> {
  try {
    const jobs = await listJobs();
    return NextResponse.json({ status: "ok", data: { jobs } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }
  const input = body as { id?: number; action?: string };
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }
  try {
    if (input.action === "retry") await retryJob(id);
    else if (input.action === "cancel") await cancelJob(id);
    else {
      return NextResponse.json(
        { status: "error", error: "action must be retry or cancel" },
        { status: 400 },
      );
    }
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
