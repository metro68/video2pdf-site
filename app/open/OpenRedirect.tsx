"use client";

import { useEffect } from "react";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";

export function OpenRedirect() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    const schemeUrl = `${FUNNEL_CONFIG.deepLinkScheme}redeem?token=${token}`;
    const storeUrl =
      `${FUNNEL_CONFIG.appStoreUrl}?deep_link_value=redeem` +
      `&deep_link_sub1=${encodeURIComponent(token)}` +
      `&af_dp=${encodeURIComponent(schemeUrl)}`;
    window.location.replace(token ? storeUrl : FUNNEL_CONFIG.appStoreUrl);
  }, []);

  return (
    <main className="min-h-[100dvh] bg-brand-bg text-brand-text flex flex-col items-center justify-center px-6 text-center">
      <p className="text-brand-text-secondary">Opening Video2PDF...</p>
    </main>
  );
}
