"use client";

import { useEffect, useState } from "react";
import { FUNNEL_CONFIG, finePrint } from "@/lib/funnel/config";
import { track } from "@/lib/pixel/events";

type Step = "landing" | "qualify1" | "qualify2" | "email" | "paywall";

const SCAN_TYPES = ["Documents", "Whiteboards", "Receipts", "Books"] as const;
type ScanType = (typeof SCAN_TYPES)[number];

const FREQUENCIES = ["Daily", "Weekly", "Sometimes"] as const;
type Frequency = (typeof FREQUENCIES)[number];

export function Funnel() {
  const [step, setStep] = useState<Step>("landing");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanType, setScanType] = useState<ScanType | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const count = FUNNEL_CONFIG.socialProofCount.toLocaleString();

  useEffect(() => {
    track("ViewContent");
  }, []);

  async function startCheckout(plan: "weekly" | "annual") {
    const cents = FUNNEL_CONFIG.plans[plan].cents;
    track("InitiateCheckout", { value: cents / 100, currency: "USD" });
    setCheckoutError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, email }),
      });
      if (res.ok === false) {
        setCheckoutError("Something went wrong starting checkout. Please try again.");
        return;
      }
      const { url } = await res.json();
      if (url) {
        window.location.assign(url);
      } else {
        setCheckoutError("Something went wrong starting checkout. Please try again.");
      }
    } catch {
      setCheckoutError("Something went wrong starting checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "landing") {
    return (
      <main className="min-h-screen bg-brand-bg text-brand-text flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-bold max-w-md">
          Turn any video or scan into a searchable PDF
        </h1>
        <p className="mt-3 text-brand-text-secondary">Join {count}+ people scanning smarter.</p>
        <button
          onClick={() => setStep("qualify1")}
          className="mt-8 rounded-lg bg-brand-primary px-8 py-3 font-semibold text-white"
        >
          Get started
        </button>
      </main>
    );
  }

  if (step === "qualify1") {
    return (
      <main className="min-h-screen bg-brand-bg text-brand-text flex flex-col items-center justify-center px-6">
        <h2 className="text-xl font-semibold mb-6">What do you scan most?</h2>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          {SCAN_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setScanType(type)}
              aria-pressed={scanType === type}
              className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                scanType === type
                  ? "border-brand-primary bg-brand-primary/20 text-brand-text"
                  : "border-brand-border bg-brand-bg-card text-brand-text-secondary"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <button
          disabled={!scanType}
          onClick={() => setStep("qualify2")}
          className="mt-8 rounded-lg bg-brand-primary px-8 py-3 font-semibold text-white disabled:opacity-40"
        >
          Continue
        </button>
      </main>
    );
  }

  if (step === "qualify2") {
    return (
      <main className="min-h-screen bg-brand-bg text-brand-text flex flex-col items-center justify-center px-6">
        <h2 className="text-xl font-semibold mb-6">How often?</h2>
        <div className="flex flex-col gap-3 w-full max-w-sm">
          {FREQUENCIES.map((freq) => (
            <button
              key={freq}
              onClick={() => setFrequency(freq)}
              aria-pressed={frequency === freq}
              className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                frequency === freq
                  ? "border-brand-primary bg-brand-primary/20 text-brand-text"
                  : "border-brand-border bg-brand-bg-card text-brand-text-secondary"
              }`}
            >
              {freq}
            </button>
          ))}
        </div>
        <button
          disabled={!frequency}
          onClick={() => setStep("email")}
          className="mt-8 rounded-lg bg-brand-primary px-8 py-3 font-semibold text-white disabled:opacity-40"
        >
          Continue
        </button>
      </main>
    );
  }

  if (step === "email") {
    return (
      <main className="min-h-screen bg-brand-bg text-brand-text flex flex-col items-center justify-center px-6">
        <h2 className="text-xl font-semibold mb-2">Where should we send your PDFs?</h2>
        <p className="text-sm text-brand-text-secondary mb-6">
          {scanType ? `Great for ${scanType.toLowerCase()}, ` : ""}
          we&apos;ll email you tips to get started.
        </p>
        <label htmlFor="email" className="sr-only">
          Your email
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-brand-border bg-brand-bg-card px-4 py-3 text-brand-text"
        />
        <button
          disabled={!email}
          onClick={() => {
            track("Lead");
            setStep("paywall");
          }}
          className="mt-6 rounded-lg bg-brand-primary px-8 py-3 font-semibold text-white disabled:opacity-40"
        >
          Continue
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text flex flex-col items-center px-6 py-10">
      <h2 className="text-2xl font-bold">Unlock Video2PDF Pro</h2>
      <p className="mt-2 text-brand-text-secondary">Trusted by {count}+ people.</p>
      <ul className="mt-6 space-y-2 text-left">
        {FUNNEL_CONFIG.proBenefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      {checkoutError && (
        <p role="alert" className="mt-6 max-w-sm text-center text-sm text-red-500">
          {checkoutError}
        </p>
      )}
      <div className="mt-8 w-full max-w-sm space-y-3">
        <button
          disabled={busy}
          onClick={() => startCheckout("weekly")}
          className="w-full rounded-lg bg-brand-primary px-6 py-3 font-semibold text-white disabled:opacity-40"
        >
          Start: {FUNNEL_CONFIG.plans.weekly.trialDays}-day free trial, then{" "}
          <span>{FUNNEL_CONFIG.plans.weekly.price}</span>/week
        </button>
        <button
          disabled={busy}
          onClick={() => startCheckout("annual")}
          className="w-full rounded-lg border border-brand-border px-6 py-3 font-semibold text-brand-text disabled:opacity-40"
        >
          Annual <span>{FUNNEL_CONFIG.plans.annual.price}</span>
        </button>
      </div>
      <small className="mt-4 max-w-sm text-center text-xs text-brand-text-secondary">
        {finePrint(FUNNEL_CONFIG.plans.weekly.price, FUNNEL_CONFIG.plans.weekly.trialDays)}
      </small>
    </main>
  );
}
