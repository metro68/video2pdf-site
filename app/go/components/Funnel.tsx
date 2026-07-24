"use client";

import { useEffect, useState } from "react";
import { FUNNEL_CONFIG, finePrint } from "@/lib/funnel/config";
import { track } from "@/lib/pixel/events";
import "../funnel.css";

type Step = "landing" | "qualify1" | "qualify2" | "email" | "paywall";

const STEPS: Step[] = ["landing", "qualify1", "qualify2", "email", "paywall"];

const SCAN_TYPES = ["Documents", "Whiteboards", "Receipts", "Books"] as const;
type ScanType = (typeof SCAN_TYPES)[number];

const FREQUENCIES = ["Daily", "Weekly", "Sometimes"] as const;
type Frequency = (typeof FREQUENCIES)[number];

function StepProgress({ step }: { step: Step }) {
  const index = STEPS.indexOf(step);
  return (
    <div className="flex w-full max-w-md items-center gap-1.5" aria-hidden="true">
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i <= index ? "bg-brand-primary" : "bg-brand-border"
          }`}
        />
      ))}
    </div>
  );
}

function Shell({
  step,
  children,
  showProgress = true,
}: {
  step: Step;
  children: React.ReactNode;
  showProgress?: boolean;
}) {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text flex flex-col items-center px-6 pt-8 pb-10">
      {showProgress && (
        <div className="mb-6 w-full flex justify-center">
          <StepProgress step={step} />
        </div>
      )}
      <div key={step} className="step-enter w-full max-w-md flex flex-col items-center">
        {children}
      </div>
    </main>
  );
}

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
      <Shell step={step}>
        <div className="bindy-float">
          <img src="/assets/bindy.png" alt="Bindy the bookworm" className="h-auto w-32" />
        </div>
        <h1 className="mt-4 text-3xl font-bold text-center">
          Turn any video or scan into a searchable PDF
        </h1>
        <p className="mt-3 text-center text-brand-text-secondary">
          Join {count}+ people scanning smarter.
        </p>
        <button
          onClick={() => setStep("qualify1")}
          className="mt-8 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white"
        >
          Get started
        </button>
      </Shell>
    );
  }

  if (step === "qualify1") {
    return (
      <Shell step={step}>
        <div className="flex w-full items-start gap-3">
          <img
            src="/assets/bindy.png"
            alt=""
            className="bindy-peek h-auto w-14 shrink-0"
          />
          <h2 className="mt-2 text-xl font-semibold">What do you scan most?</h2>
        </div>
        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          {SCAN_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setScanType(type)}
              aria-pressed={scanType === type}
              className={`rounded-lg border px-4 py-4 text-sm font-medium ${
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
          className="mt-8 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          Continue
        </button>
      </Shell>
    );
  }

  if (step === "qualify2") {
    return (
      <Shell step={step}>
        <div className="flex w-full items-start gap-3">
          <img
            src="/assets/bindy.png"
            alt=""
            className="bindy-peek h-auto w-14 shrink-0"
          />
          <h2 className="mt-2 text-xl font-semibold">How often?</h2>
        </div>
        <div className="mt-6 flex w-full flex-col gap-3">
          {FREQUENCIES.map((freq) => (
            <button
              key={freq}
              onClick={() => setFrequency(freq)}
              aria-pressed={frequency === freq}
              className={`rounded-lg border px-4 py-4 text-sm font-medium ${
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
          className="mt-8 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          Continue
        </button>
      </Shell>
    );
  }

  if (step === "email") {
    return (
      <Shell step={step}>
        <h2 className="w-full text-xl font-semibold">Where should we send your PDFs?</h2>
        <p className="mt-2 w-full text-sm text-brand-text-secondary">
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
          className="mt-6 w-full rounded-lg border border-brand-border bg-brand-bg-card px-4 py-4 text-brand-text"
        />
        <button
          disabled={!email}
          onClick={() => {
            track("Lead");
            setStep("paywall");
          }}
          className="mt-6 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          Continue
        </button>
      </Shell>
    );
  }

  return (
    <Shell step={step}>
      <div className="flex w-full flex-col items-center text-center">
        <img src="/assets/bindy.png" alt="Bindy the bookworm" className="bindy-float h-auto w-20" />
        <h2 className="mt-3 text-2xl font-bold">Unlock Video2PDF Pro</h2>
        <p className="mt-2 text-brand-text-secondary">Trusted by {count}+ people.</p>
      </div>
      <ul className="mt-6 w-full space-y-2 text-left">
        {FUNNEL_CONFIG.proBenefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      {checkoutError && (
        <p role="alert" className="mt-6 w-full text-center text-sm text-red-500">
          {checkoutError}
        </p>
      )}
      <div className="mt-8 w-full space-y-3">
        <button
          disabled={busy}
          onClick={() => startCheckout("weekly")}
          className="w-full rounded-lg border border-brand-border px-6 py-4 font-semibold text-brand-text disabled:opacity-40"
        >
          Weekly <span>{FUNNEL_CONFIG.plans.weekly.price}</span>/week
        </button>
        <button
          disabled={busy}
          onClick={() => startCheckout("annual")}
          className="w-full rounded-lg bg-brand-primary px-6 py-4 font-semibold text-white disabled:opacity-40"
        >
          {FUNNEL_CONFIG.plans.annual.trialDays}-day free trial, then{" "}
          <span>{FUNNEL_CONFIG.plans.annual.price}</span>/year
        </button>
      </div>
      <small className="mt-4 w-full text-center text-xs text-brand-text-secondary">
        {finePrint(FUNNEL_CONFIG.plans.annual.price, FUNNEL_CONFIG.plans.annual.trialDays)}
      </small>
    </Shell>
  );
}
