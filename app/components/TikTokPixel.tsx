"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { trackTikTokPageView } from "@/lib/pixel/events";

export function TikTokPixel() {
  // Comma-separated so more pixels can be added without a code change. TikTok
  // requires a separate pixel per targeted region, so the USA campaigns run on
  // their own id alongside the original.
  const ids = (process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const pathname = usePathname();
  const mounted = useRef(false);

  // The base snippet already calls ttq.page() on load, so this effect only
  // reports the client-side route changes Next.js makes without a full reload.
  // The first run is skipped so the initial pageview is not counted twice.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (ids.length) trackTikTokPageView();
  }, [pathname, ids.length]);

  if (!ids.length) return null;

  // ttq.load() is called once per pixel. The SDK keeps an instance per id, and
  // a bare ttq.track()/ttq.page() fans out to all of them.
  const loadCalls = ids.map((id) => `ttq.load('${id}');`).join("\n        ");

  return (
    <Script id="tiktok-pixel" strategy="afterInteractive">{`
      !function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
      var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
      ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

        ${loadCalls}
        ttq.page();
      }(window, document, 'ttq');
    `}</Script>
  );
}
