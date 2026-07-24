import { createHash } from "node:crypto";

export interface SendCapiPurchaseInput {
  email: string;
  value: number;
  currency: string;
  eventId: string;
}

export async function sendCapiPurchase(input: SendCapiPurchaseInput): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return;

  const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`;
  const hashedEmail = createHash("sha256")
    .update(input.email.trim().toLowerCase())
    .digest("hex");
  const body = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_id: input.eventId,
        user_data: { em: hashedEmail },
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
