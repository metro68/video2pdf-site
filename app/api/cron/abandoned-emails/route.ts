import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { sendReminderEmail } from "@/lib/email/resend";
import { unsubscribeToken } from "@/lib/email/unsubscribe";

const MAX_PER_RUN = 50;

interface EligibleLeadRow {
  email: string;
}

// Reads env inside the handler so test-time env stubs are honored. Vercel Cron
// sends `authorization: Bearer <CRON_SECRET>` automatically when the CRON_SECRET
// env var exists on the project, so this doubles as both the auth check and the
// guard against manual/unauthenticated invocation.
export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.video2pdf.ai";

  const result = await sql<EligibleLeadRow>`
    SELECT email FROM leads
    WHERE reminder_sent_at IS NULL
      AND unsubscribed_at IS NULL
      AND created_at <= now() - interval '4 hours'
      AND created_at > now() - interval '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.email = leads.email AND s.status IN ('trialing','active','past_due')
      )
    LIMIT ${MAX_PER_RUN}
  `;

  let sent = 0;
  for (const row of result.rows) {
    const email = row.email;
    const token = unsubscribeToken(email);
    const unsubscribeUrl = `${siteUrl}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${token}`;
    const ok = await sendReminderEmail(email, unsubscribeUrl);
    if (ok) {
      await sql`UPDATE leads SET reminder_sent_at = now() WHERE email = ${email}`;
      sent += 1;
      console.log(`Sent abandoned checkout reminder to ${email}`);
    }
  }

  return NextResponse.json({ sent });
}
