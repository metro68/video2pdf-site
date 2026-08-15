"use client";

import { useEffect } from "react";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";

export function OpenRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") ?? "";
    const campaign = params.get("c") ?? "";
    const ad = params.get("a") ?? "";
    const schemeUrl = `${FUNNEL_CONFIG.deepLinkScheme}redeem?token=${token}`;
    // pid names the web funnel handoff as the media source, and c/af_ad carry
    // the originating ad's identifiers, so AppsFlyer credits these installs to
    // the campaign that started the chain instead of a bare OneLink click.
    const attribution =
      `&pid=web_funnel` +
      (campaign ? `&c=${encodeURIComponent(campaign)}` : "") +
      (ad ? `&af_ad=${encodeURIComponent(ad)}` : "");
    const storeUrl =
      `${FUNNEL_CONFIG.appStoreUrl}?deep_link_value=redeem` +
      `&deep_link_sub1=${encodeURIComponent(token)}` +
      `&af_dp=${encodeURIComponent(schemeUrl)}` +
      attribution;
    window.location.replace(token ? storeUrl : `${FUNNEL_CONFIG.appStoreUrl}?pid=web_funnel`);
  }, []);

  return (
    <main className="min-h-dvh bg-brand-bg text-brand-text flex flex-col items-center justify-center px-6 text-center">
      <p className="text-brand-text-secondary">Opening Video2PDF...</p>
    </main>
  );
}
