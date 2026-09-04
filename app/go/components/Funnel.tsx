"use client";

import { useEffect, useState } from "react";
import { FUNNEL_CONFIG, finePrint } from "@/lib/funnel/config";
import { track, trackCustom, identify } from "@/lib/pixel/events";
import { ProductDemo } from "@/app/components/landing/ProductDemo";
import "../funnel.css";

// The qualify quiz steps were cut on 2026-08-15: funnel data showed 85% of
// paid landings never reached the email gate, so the flow is now the shortest
// path to email and paywall.
type Step = "landing" | "email" | "paywall";

const STEPS: Step[] = ["landing", "email", "paywall"];

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

// TikTok's click id arrives as a ttclid query param on the ad click. The pixel
// stores it in a _ttclid cookie, but only once its SDK has loaded, so the URL is
// read first and the value stashed in sessionStorage to survive the funnel's
// later steps (the param is gone after the Stripe round trip).
const TTCLID_KEY = "v2p_ttclid";

function readTtclid(): string | undefined {
  const fromUrl = new URLSearchParams(window.location.search).get("ttclid");
  if (fromUrl) {
    try {
      window.sessionStorage.setItem(TTCLID_KEY, fromUrl);
    } catch {
      // Private-mode storage failures are non-fatal: attribution degrades to
      // the _ttp cookie and email match.
    }
    return fromUrl;
  }
  try {
    return window.sessionStorage.getItem(TTCLID_KEY) ?? readCookie("_ttclid");
  } catch {
    return readCookie("_ttclid");
  }
}

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
    <main className="min-h-dvh overflow-y-auto bg-brand-bg text-brand-text flex flex-col items-center px-6 pt-8 pb-24">
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
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [src, setSrc] = useState("direct");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const count = FUNNEL_CONFIG.socialProofCount.toLocaleString();

  useEffect(() => {
    track("ViewContent");
    // Stash the TikTok click id before the funnel navigates away from the ad URL.
    readTtclid();
    const params = new URLSearchParams(window.location.search);
    const source = params.get("src") ?? "direct";
    const campaign = params.get("utm_campaign") ?? "";
    const content = params.get("utm_content") ?? "";
    setUtmCampaign(campaign);
    setUtmContent(content);
    // Composes the src convention consumed by the lead API: "<src>|c:<campaign>|a:<content>".
    // Each segment is appended only when its value is present, so a single utm
    // param never leaves a dangling empty "|c:" or "|a:" segment.
    const segments = [
      source,
      campaign ? `c:${campaign}` : null,
      content ? `a:${content}` : null,
    ].filter((segment): segment is string => segment !== null);
    setSrc(segments.join("|"));
    trackCustom("funnel_opened", { source });
  }, []);

  useEffect(() => {
    if (step === "email") {
      trackCustom("funnel_email_step_viewed");
    } else if (step === "paywall") {
      trackCustom("funnel_paywall_viewed");
    }
  }, [step]);

  async function startCheckout(plan: "weekly" | "annual") {
    const cents = FUNNEL_CONFIG.plans[plan].cents;
    const value = cents / 100;
    track("InitiateCheckout", { value, currency: "USD" });
    // StartTrial deliberately does NOT fire here: it fires on the success page
    // with the checkout-session eventID so it dedups against the webhook's
    // CAPI StartTrial, and so abandoned checkouts are not counted as trials.
    trackCustom("funnel_plan_selected", { plan, value });
    setCheckoutError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Meta's _fbp/_fbc and TikTok's _ttp/ttclid ride along into Stripe
        // session metadata so the webhook's server-side conversion events can
        // match the click, not just the email.
        body: JSON.stringify({
          plan,
          email,
          fbp: readCookie("_fbp"),
          fbc: readCookie("_fbc"),
          ttp: readCookie("_ttp"),
          ttclid: readTtclid(),
          ...(utmCampaign ? { utmCampaign } : {}),
          ...(utmContent ? { utmContent } : {}),
        }),
      });
      if (res.ok === false) {
        trackCustom("funnel_checkout_error", { plan });
        setCheckoutError("Something went wrong starting checkout. Please try again.");
        return;
      }
      const { url } = await res.json();
      if (url) {
        trackCustom("funnel_checkout_redirect", { plan });
        window.location.assign(url);
      } else {
        trackCustom("funnel_checkout_error", { plan });
        setCheckoutError("Something went wrong starting checkout. Please try again.");
      }
    } catch {
      trackCustom("funnel_checkout_error", { plan });
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
        <div className="mt-4 w-full">
          <ProductDemo heightClassName="h-[280px]" />
        </div>
        {/* mt-auto pushes the CTA to the bottom of the full-height shell, so
            spare viewport space becomes the gap above it instead of dead space
            below. On phones short enough that the content overflows, sticky
            takes over and z-30 keeps the button above the demo cards (z-20). */}
        <div className="sticky bottom-0 z-30 mt-auto w-full bg-gradient-to-t from-brand-bg via-brand-bg/90 to-transparent pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => {
              trackCustom("funnel_get_started");
              setStep("email");
            }}
            className="w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white"
          >
            Start Free Trial
          </button>
        </div>
      </Shell>
    );
  }

  if (step === "email") {
    return (
      <Shell step={step}>
        <h2 className="w-full text-xl font-semibold">Where should we send your PDFs?</h2>
        <p className="mt-2 w-full text-sm text-brand-text-secondary">
          We&apos;ll email you tips to get started.
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
            // Identify before Lead so this and every later TikTok event on the
            // page carries the (SDK-hashed) email as a match signal.
            identify(email);
            track("Lead");
            trackCustom("funnel_email_submitted");
            // Fire-and-forget: lead capture must never block or error out the
            // funnel, so no await and errors are swallowed.
            fetch("/api/lead", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email, src }),
            }).catch(() => {});
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
        <img src="/assets/bindy.png" alt="Bindy the bookworm" className="bindy-float h-auto w-40" />
        <h2 className="mt-3 text-2xl font-bold">Unlock Video2PDF Pro</h2>
        <p className="mt-2 text-brand-text-secondary">Trusted by {count}+ people.</p>
      </div>
      <ul className="mt-6 w-full space-y-2 text-left">
        {FUNNEL_CONFIG.proBenefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      <div className="mt-6 w-full rounded-lg border border-brand-primary/60 bg-brand-primary/10 p-4 text-center">
        <span className="inline-block rounded-full bg-brand-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Back to school deal
        </span>
        <p className="mt-2 text-xl font-bold">
          <s className="mr-2 font-normal text-brand-text-secondary">
            ${Math.round((FUNNEL_CONFIG.plans.weekly.cents * 52) / 100)}/year
          </s>
          $29.99/year
        </p>
        <p className="mt-1 text-xs text-brand-text-secondary">
          vs {FUNNEL_CONFIG.plans.weekly.price}/week billed weekly. Lock it in for
          life, your price never goes up.
        </p>
      </div>
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
