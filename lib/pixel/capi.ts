import { createHash } from "node:crypto";

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

interface SendCapiEventInput {
  email: string;
  value: number;
  currency: string;
  eventId: string;
  // Meta browser identifiers (_fbp/_fbc cookies) captured at checkout; they
  // raise event match quality well above email-only matching. Unhashed by
  // Meta's spec.
  fbp?: string;
  fbc?: string;
}

async function sendCapiEvent(eventName: string, input: SendCapiEventInput): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return;

  const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`;
  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_id: input.eventId,
        user_data: {
          em: hashEmail(input.email),
          ...(input.fbp ? { fbp: input.fbp } : {}),
          ...(input.fbc ? { fbc: input.fbc } : {}),
        },
        custom_data: { value: input.value, currency: input.currency },
      },
    ],
  };

  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type SendCapiPurchaseInput = SendCapiEventInput;

export async function sendCapiPurchase(input: SendCapiPurchaseInput): Promise<void> {
  await sendCapiEvent("Purchase", input);
}

export type SendCapiStartTrialInput = SendCapiEventInput;

export async function sendCapiStartTrial(input: SendCapiStartTrialInput): Promise<void> {
  await sendCapiEvent("StartTrial", input);
}
