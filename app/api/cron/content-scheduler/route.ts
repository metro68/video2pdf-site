import { NextResponse } from "next/server";
import { listDue } from "@/lib/db/content/publications";
import { enqueueJob } from "@/lib/db/content/jobs";

// Turns due publications into publish jobs for the worker.
//
// This route only enqueues; it never calls a platform API itself. The actual
// posting happens on the worker, which has the dry-run guard and the
// platform_post_id duplicate check.
//
// Auth matches the existing abandoned-emails cron: Vercel Cron sends
// `authorization: Bearer <CRON_SECRET>` when CRON_SECRET exists on the project,
// so this is both the auth check and the guard against manual invocation.
export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await listDue();
  let queued = 0;

  for (const publication of due) {
    // The idempotency key is the publication id, so a publish job is created
    // once no matter how often the cron runs while the job is pending.
    await enqueueJob({
      kind: "publish",
      variantId: publication.variantId,
      accountId: publication.accountId,
      payload: { publicationId: publication.id },
      idempotencyKey: `publish:${publication.id}`,
    });
    queued += 1;
  }

  return NextResponse.json({ queued });
}
