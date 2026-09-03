import { NextResponse } from "next/server";
import { enqueueJob } from "@/lib/db/content/jobs";

// Enqueues a metrics sync for the worker. Same cron auth as the other cron
// routes. The idempotency key is the hour, so repeated runs inside one hour do
// not stack up duplicate sync jobs.
export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hour = new Date().toISOString().slice(0, 13);
  await enqueueJob({ kind: "sync_metrics", idempotencyKey: `sync_metrics:${hour}` });
  return NextResponse.json({ queued: 1 });
}
