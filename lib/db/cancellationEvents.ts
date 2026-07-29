import { sql, type Plan } from "./client";

export type CancelStep = "survey" | "loss" | "offer" | "confirm";
export type CancelOutcome =
  | "saved_offer"
  | "paused"
  | "canceled"
  | "resumed"
  | "abandoned_kept";

export interface CancellationEventInput {
  email: string;
  plan: Plan;
  reason?: string | null;
  comment?: string | null;
  stepReached: CancelStep;
  outcome?: CancelOutcome | null;
}

export async function insertCancellationEvent(
  input: CancellationEventInput,
): Promise<void> {
  await sql`
    INSERT INTO cancellation_events (email, plan, reason, comment, step_reached, outcome)
    VALUES (${input.email.trim().toLowerCase()}, ${input.plan}, ${input.reason ?? null},
            ${input.comment ?? null}, ${input.stepReached}, ${input.outcome ?? null})
  `;
}
