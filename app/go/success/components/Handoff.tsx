"use client";

import { useEffect, useRef } from "react";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";
import { track } from "@/lib/pixel/events";
import "../../funnel.css";

export interface HandoffProps {
  token: string;
  value: number;
  eventId: string;
}

export function Handoff({ token, value, eventId }: HandoffProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track("Purchase", { value, currency: "USD" }, eventId);
  }, [value, eventId]);

  // OneLink universal link: opens the installed app directly (no custom-scheme
  // error dialog), or the right store when the app is missing. The redeem params
  // ride along so the app (or AppsFlyer deferred deep linking after install)
  // unlocks silently; the token is never shown to the user. af_dp carries the
  // scheme URL as a fallback for installed apps without universal-link support.
  const schemeUrl = `${FUNNEL_CONFIG.deepLinkScheme}redeem?token=${token}`;
  const href =
    `${FUNNEL_CONFIG.appStoreUrl}?deep_link_value=redeem` +
    `&deep_link_sub1=${encodeURIComponent(token)}` +
    `&af_dp=${encodeURIComponent(schemeUrl)}`;

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

        <div className="mt-8 w-full rounded-lg border border-brand-border bg-brand-bg-card p-4">
          <p className="text-sm text-brand-text-secondary">
            On another device, or the app did not unlock? Install and open Video2PDF,
            tap &quot;I already subscribed on the web&quot; on the paywall, and enter the
            email you used at checkout.
          </p>
        </div>

        <a href="/manage" className="mt-6 text-xs text-brand-text-secondary underline">
          Manage or cancel anytime
        </a>
      </div>
    </main>
  );
}
