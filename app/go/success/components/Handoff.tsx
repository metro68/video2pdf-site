"use client";

import { useEffect, useRef, useState } from "react";
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track("Purchase", { value, currency: "USD" }, eventId);
  }, [value, eventId]);

  const href = `${FUNNEL_CONFIG.deepLinkScheme}redeem?token=${token}`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context); the code is
      // still visible on screen for the user to copy manually.
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text flex flex-col items-center px-6 pt-10 pb-10">
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
            If the link does not open, enter this code in the app under &quot;I already
            subscribed&quot;:
          </p>
          <code className="mt-3 block rounded-lg border border-brand-border bg-brand-bg px-4 py-3 text-lg font-mono tracking-wide">
            {token}
          </code>
          <button
            type="button"
            onClick={copyCode}
            className="mt-3 w-full rounded-lg border border-brand-border px-6 py-3 text-sm font-semibold text-brand-text"
          >
            {copied ? "Copied!" : "Copy code"}
          </button>
        </div>
      </div>
    </main>
  );
}
