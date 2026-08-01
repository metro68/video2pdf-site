import { sql } from "./client";

export interface UpsertLeadInput {
  email: string;
  scanType?: string | null;
  frequency?: string | null;
  src?: string | null;
}

// Every email submitted on the /go funnel's email step is stored here, whether
// or not the visitor completes checkout. created_at, reminder_sent_at, and
// unsubscribed_at are intentionally left out of the ON CONFLICT update so a
// returning visitor refreshes their answers without resetting the abandoned
// checkout reminder clock or resurrecting an unsubscribe.
export async function upsertLead(input: UpsertLeadInput): Promise<void> {
  const email = input.email.trim().toLowerCase();
  await sql`
    INSERT INTO leads (email, scan_type, frequency, src)
    VALUES (${email}, ${input.scanType ?? null}, ${input.frequency ?? null}, ${input.src ?? null})
    ON CONFLICT (email) DO UPDATE SET
      scan_type = EXCLUDED.scan_type,
      frequency = EXCLUDED.frequency,
      src = EXCLUDED.src
  `;
}

export async function markUnsubscribed(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await sql`
    UPDATE leads SET unsubscribed_at = now()
    WHERE email = ${normalized}
  `;
}
