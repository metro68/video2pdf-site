"use client";

import { useEffect, useRef } from "react";
import { FUNNEL_CONFIG } from "@/lib/funnel/config";
import { track } from "@/lib/pixel/events";

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

  const href = `${FUNNEL_CONFIG.deepLinkScheme}redeem?token=${token}`;

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">You are subscribed. Get the app.</h1>
      <a
        href={href}
        className="mt-8 rounded-lg bg-brand-primary px-8 py-3 font-semibold text-white"
      >
        Open the app
      </a>
      <p className="mt-6 text-sm text-brand-text-secondary max-w-sm">
        If that does not open the app, enter this code in the app under &quot;I already
        subscribed&quot;:
      </p>
      <code className="mt-2 rounded-lg border border-brand-border bg-brand-bg-card px-4 py-2 text-lg font-mono">
        {token}
      </code>
    </main>
  );
}
