import { createHash } from "node:crypto";

const ENDPOINT = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export interface SendTikTokEventInput {
  email: string;
  value: number;
  currency: string;
  eventId: string;
  // TikTok browser identifiers captured at checkout: _ttp is the pixel's first
  // party cookie, ttclid the click id from the ad URL. Both are sent unhashed
  // per TikTok's spec and lift match quality well above email-only.
  ttp?: string;
  ttclid?: string;
  /** Page URL the conversion is attributed to. TikTok recommends sending it. */
  url?: string;
}

/**
 * TikTok's standard event names differ from Meta's; callers pass the TikTok
 * name directly. `event_id` is shared with the browser pixel event so TikTok
 * dedups the pair (it keys on event_source_id + event + event_id).
 */
async function sendTikTokEvent(eventName: string, input: SendTikTokEventInput): Promise<void> {
  const pixelId = process.env.TIKTOK_PIXEL_ID;
  const token = process.env.TIKTOK_EVENTS_ACCESS_TOKEN;
  if (!pixelId || !token) return;

  const body = {
    event_source: "web",
    event_source_id: pixelId,
    data: [
      {
        event: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        user: {
          email: sha256(input.email),
          ...(input.ttp ? { ttp: input.ttp } : {}),
          ...(input.ttclid ? { ttclid: input.ttclid } : {}),
        },
        ...(input.url ? { page: { url: input.url } } : {}),
        properties: { value: input.value, currency: input.currency },
      },
    ],
  };

  await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "Access-Token": token },
    body: JSON.stringify(body),
  });
}

/** A card was actually charged. TikTok's standard purchase event. */
export async function sendTikTokPurchase(input: SendTikTokEventInput): Promise<void> {
  await sendTikTokEvent("CompletePayment", input);
}

/**
 * A free trial started. TikTok has no StartTrial event, so this reports
 * Subscribe, the closest standard event its optimizer bids on.
 */
export async function sendTikTokStartTrial(input: SendTikTokEventInput): Promise<void> {
  await sendTikTokEvent("Subscribe", input);
}
