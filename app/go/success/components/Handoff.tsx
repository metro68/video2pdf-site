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

  // The token rides along in the deep link so the app can unlock silently; it is
  // never shown to the user. The visible fallback is their checkout email.
  const href = `${FUNNEL_CONFIG.deepLinkScheme}redeem?token=${token}`;

  // With the app installed the scheme opens it instantly. Without it, the scheme
  // errors, so after a short wait (page still visible = app did not open) we send
  // the user to the store via OneLink, carrying the redeem params so AppsFlyer
  // deferred deep linking can still unlock silently on first open after install.
  const storeFallbackUrl =
    `${FUNNEL_CONFIG.appStoreUrl}?deep_link_value=redeem` +
    `&deep_link_sub1=${encodeURIComponent(token)}` +
    `&af_dp=${encodeURIComponent(href)}`;

  function openApp(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const fallback = setTimeout(() => {
      if (!document.hidden) window.location.href = storeFallbackUrl;
    }, 1600);
    const cancel = () => clearTimeout(fallback);
    window.addEventListener("pagehide", cancel, { once: true });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) cancel();
      },
      { once: true },
    );
    window.location.href = href;
  }

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
          onClick={openApp}
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
