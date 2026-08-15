"use client";

import { useEffect, useRef } from "react";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";
import { track } from "@/lib/pixel/events";
import "../../funnel.css";

export interface HandoffProps {
  token: string;
  value: number;
  eventId: string;
  isTrial?: boolean;
  /** Originating ad identifiers, forwarded to /open for install attribution. */
  utmCampaign?: string;
  utmContent?: string;
}

export function Handoff({
  token,
  value,
  eventId,
  isTrial = false,
  utmCampaign = "",
  utmContent = "",
}: HandoffProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    // Purchase means "card actually charged": a trial checkout collects $0, so
    // it fires StartTrial only; its Purchase comes server-side from Stripe's
    // invoice.paid when the trial converts. A no-trial plan is charged here,
    // so it fires Purchase. Each shares the session eventID with its CAPI
    // twin from the webhook, so Meta dedups the pair.
    if (isTrial) {
      track("StartTrial", { value, currency: "USD", predicted_ltv: value }, eventId);
    } else {
      track("Purchase", { value, currency: "USD" }, eventId);
    }
  }, [value, eventId, isTrial]);

  // Our own universal link (AASA served by this site on a separate host so iOS
  // does not suppress it as same-domain): installed app opens directly with the
  // token; without the app, the /open page forwards to the OneLink store link
  // with the redeem params for deferred deep linking. Token never shown.
  const href =
    `${FUNNEL_CONFIG.appLinkBase}/open?token=${encodeURIComponent(token)}` +
    (utmCampaign ? `&c=${encodeURIComponent(utmCampaign)}` : "") +
    (utmContent ? `&a=${encodeURIComponent(utmContent)}` : "");

  return (
    <main className="min-h-[100dvh] overflow-y-auto bg-brand-bg text-brand-text flex flex-col items-center px-6 pt-10 pb-24">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        <img
          src="/assets/bindy.png"
          alt="Bindy the bookworm celebrating"
          className="bindy-celebrate h-auto w-24"
        />
        <h1 className="mt-4 text-2xl font-bold">You are subscribed. Get the app.</h1>
        <a
          href={href}
          className="mt-8 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white"
        >
          Open the app
        </a>

        <details className="mt-8 w-full rounded-lg border border-brand-border bg-brand-bg-card p-4 text-left">
          <summary className="cursor-pointer text-sm font-medium text-brand-text-secondary">
            Trouble opening the app, or on another device?
          </summary>
          <p className="mt-3 text-sm text-brand-text-secondary">
            Install and open Video2PDF, tap &quot;I already subscribed on the web&quot;
            on the paywall, and enter the email you used at checkout.
          </p>
        </details>
      </div>
    </main>
  );
}
