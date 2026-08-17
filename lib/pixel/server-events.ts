import { sendCapiPurchase, sendCapiStartTrial } from "@/lib/pixel/capi";
import { sendTikTokPurchase, sendTikTokStartTrial } from "@/lib/pixel/tiktok-capi";

export interface ServerConversionInput {
  email: string;
  value: number;
  currency: string;
  /** Shared with the browser event so each network dedups its own pair. */
  eventId: string;
  /** Meta browser identifiers. */
  fbp?: string;
  fbc?: string;
  /** TikTok browser identifiers. */
  ttp?: string;
  ttclid?: string;
}

// Each network is dispatched independently and its failures are swallowed: one
// ad platform being down or misconfigured must never fail the Stripe webhook,
// which would make Stripe retry and re-report the conversion to the network
// that did succeed.
async function fanOut(
  input: ServerConversionInput,
  meta: (i: ServerConversionInput) => Promise<void>,
  tiktok: (i: ServerConversionInput) => Promise<void>
): Promise<void> {
  await Promise.allSettled([meta(input), tiktok(input)]);
}

/** Reports a real charge to every configured ad network, server-side. */
export async function reportPurchase(input: ServerConversionInput): Promise<void> {
  await fanOut(
    input,
    (i) => sendCapiPurchase({ email: i.email, value: i.value, currency: i.currency, eventId: i.eventId, fbp: i.fbp, fbc: i.fbc }),
    (i) => sendTikTokPurchase({ email: i.email, value: i.value, currency: i.currency, eventId: i.eventId, ttp: i.ttp, ttclid: i.ttclid })
  );
}

/** Reports a trial start to every configured ad network, server-side. */
export async function reportStartTrial(input: ServerConversionInput): Promise<void> {
  await fanOut(
    input,
    (i) => sendCapiStartTrial({ email: i.email, value: i.value, currency: i.currency, eventId: i.eventId, fbp: i.fbp, fbc: i.fbc }),
    (i) => sendTikTokStartTrial({ email: i.email, value: i.value, currency: i.currency, eventId: i.eventId, ttp: i.ttp, ttclid: i.ttclid })
  );
}
