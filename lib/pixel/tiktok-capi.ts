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

function splitEnv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Pairs each pixel id with its own access token, positionally. TikTok issues a
 * separate token per pixel, so the two lists must line up: the Nth id is sent
 * with the Nth token. A single shared token is also supported, since one token
 * is reused for every id when only one is configured.
 */
function pixelTargets(): { pixelId: string; token: string }[] {
  const ids = splitEnv(process.env.TIKTOK_PIXEL_ID);
  const tokens = splitEnv(process.env.TIKTOK_EVENTS_ACCESS_TOKEN);
  if (!ids.length || !tokens.length) return [];
  return ids
    .map((pixelId, i) => ({ pixelId, token: tokens.length === 1 ? tokens[0] : tokens[i] }))
    .filter((target): target is { pixelId: string; token: string } => Boolean(target.token));
}

/**
 * Sends one server-side event to every configured pixel. `event_id` is shared
 * with the browser pixel event so TikTok dedups the pair (it keys on
 * event_source_id + event + event_id), and since each pixel gets the same
 * event_id, each dedups independently against its own browser event.
 *
 * Failures are swallowed per pixel: one pixel's token being wrong must not stop
 * the others from reporting, nor fail the Stripe webhook and trigger a retry
 * that double-reports to the pixels that already succeeded.
 */
async function sendTikTokEvent(eventName: string, input: SendTikTokEventInput): Promise<void> {
  const targets = pixelTargets();
  if (!targets.length) return;

  const eventTime = Math.floor(Date.now() / 1000);

  await Promise.allSettled(
    targets.map(({ pixelId, token }) =>
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "Access-Token": token },
        body: JSON.stringify({
          event_source: "web",
          event_source_id: pixelId,
          data: [
            {
              event: eventName,
              event_time: eventTime,
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
        }),
      })
    )
  );
}

/**
 * A card was actually charged. TikTok renamed this event from CompletePayment
 * to Purchase in May 2025; the old name is still auto-converted in reporting,
 * but new setups send Purchase.
 */
export async function sendTikTokPurchase(input: SendTikTokEventInput): Promise<void> {
  await sendTikTokEvent("Purchase", input);
}

/** A free trial started. StartTrial is a TikTok standard event in its own right. */
export async function sendTikTokStartTrial(input: SendTikTokEventInput): Promise<void> {
  await sendTikTokEvent("StartTrial", input);
}
