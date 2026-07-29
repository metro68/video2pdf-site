"use client";

import { useEffect, useState } from "react";
import type { ManageOverview } from "@/lib/manage/overview";
import { MANAGE_CONFIG, type CancelReasonId } from "@/lib/manage/config";
import { fmtDate } from "@/app/manage/components/ManageForm";

type View = "survey" | "loss" | "offer" | "confirm" | "done" | "saved" | "kept";

interface FlowState {
  token: string;
  overview: ManageOverview;
}

const PRO_BENEFITS = [
  "Full-resolution scans",
  "Searchable, copyable PDFs",
  "Unlimited documents",
];

export function CancelWizard() {
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [view, setView] = useState<View>("survey");
  const [reason, setReason] = useState<CancelReasonId | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelFails, setCancelFails] = useState(0);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("v2p_manage");
      const parsed = raw ? (JSON.parse(raw) as FlowState) : null;
      if (parsed?.token && parsed?.overview) setFlow(parsed);
      else window.location.replace("/manage");
    } catch {
      window.location.replace("/manage");
    }
  }, []);

  if (!flow) return null;
  const { token, overview } = flow;
  const endDate = fmtDate(overview.currentPeriodEnd);

  async function post(path: string, body: unknown): Promise<Response> {
    return fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function sendFeedback(extra: Record<string, unknown>) {
    // Fire and forget: survey data must never block navigation.
    post("/api/manage/feedback", { token, reason, comment, ...extra }).catch(() => {});
  }

  function advanceFromSurvey(chosen: CancelReasonId) {
    setReason(chosen);
    // reason state hasn't updated yet at click time, so pass the chosen
    // reason explicitly rather than letting sendFeedback close over state.
    sendFeedback({ reason: chosen, stepReached: "survey" });
    setView("loss");
  }

  function pastLoss() {
    setView(overview.offerAvailable ? "offer" : "confirm");
  }

  async function acceptOffer() {
    setError(null);
    setBusy(true);
    try {
      const res = await post("/api/manage/offer", { token });
      if (res.ok) setView("saved");
      else setError("Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    setError(null);
    setBusy(true);
    try {
      const res = await post("/api/manage/cancel", { token, reason, comment });
      if (res.ok) {
        setView("done");
      } else {
        setCancelFails((n) => n + 1);
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setCancelFails((n) => n + 1);
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function fallbackPortalCancel() {
    setBusy(true);
    try {
      const res = await post("/api/manage/portal", { token, fallbackCancel: true });
      const data = await res.json().catch(() => ({}));
      if (data?.url) window.location.assign(data.url);
      else setError("Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const quietLink = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 text-sm text-brand-text-secondary underline"
    >
      {label}
    </button>
  );

  const shell = (children: React.ReactNode) => (
    <main className="min-h-[100dvh] overflow-y-auto bg-brand-bg text-brand-text flex flex-col items-center px-6 pt-10 pb-16">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        {children}
        {error && (
          <p role="alert" className="mt-4 w-full text-center text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    </main>
  );

  if (view === "survey") {
    return shell(
      <>
        <h1 className="text-2xl font-bold">Before you go, what's not working?</h1>
        <div className="mt-6 w-full flex flex-col gap-3">
          {MANAGE_CONFIG.cancelReasons.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              className={`w-full rounded-lg border px-4 py-4 text-left ${
                reason === r.id
                  ? "border-brand-primary bg-brand-bg-card"
                  : "border-brand-border bg-brand-bg-card"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <textarea
          placeholder="Anything else you want us to know? (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-4 w-full rounded-lg border border-brand-border bg-brand-bg-card px-4 py-3 text-sm"
          rows={2}
        />
        <button
          type="button"
          disabled={!reason}
          onClick={() => reason && advanceFromSurvey(reason)}
          className="mt-6 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          Next
        </button>
        {quietLink("Continue to cancel", () => advanceFromSurvey("skipped"))}
      </>,
    );
  }

  if (view === "loss") {
    return shell(
      <>
        <h1 className="text-2xl font-bold">Here's what you'll lose on {endDate}</h1>
        <div className="mt-6 w-full rounded-xl border-2 border-brand-primary bg-brand-bg-card p-5 text-left">
          <span className="inline-block rounded-full bg-brand-primary px-3 py-1 text-xs font-semibold text-white">
            Only on Video2PDF
          </span>
          <p className="mt-3 text-lg font-bold">
            Crisp, clean PDFs generated from your videos
          </p>
          <p className="mt-1 text-sm text-brand-text-secondary">
            Video2PDF is the only app that turns your videos into crisp, print-ready
            PDFs.
          </p>
        </div>
        <ul className="mt-4 w-full flex flex-col gap-2 text-left">
          {PRO_BENEFITS.map((b) => (
            <li
              key={b}
              className="rounded-lg border border-brand-border bg-brand-bg-card px-4 py-3 text-sm"
            >
              {b}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-brand-text-secondary">
          You keep all of this until {endDate}. After that it's gone.
        </p>
        <button
          type="button"
          onClick={() => {
            sendFeedback({ stepReached: "loss", outcome: "abandoned_kept" });
            setView("kept");
          }}
          className="mt-6 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white"
        >
          Keep my benefits
        </button>
        {quietLink("Continue to cancel", pastLoss)}
      </>,
    );
  }

  if (view === "offer") {
    const annual = overview.plan === "annual";
    const pauseEnd = fmtDate(Date.now() + MANAGE_CONFIG.pauseDays * 24 * 60 * 60 * 1000);
    return shell(
      <>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-primary">
          Wait, one last thing
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {annual ? "Stay for $0.99" : "Take 30 days on us"}
        </h1>
        <p className="mt-2 text-brand-text-secondary">
          {annual
            ? "Your entire next year, 97% off."
            : "No charges for 30 days. Pick up right where you left off."}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={acceptOffer}
          className="mt-8 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          {annual ? "Claim my $0.99 year" : "Pause my plan for 30 days"}
        </button>
        <p className="mt-3 text-xs text-brand-text-secondary">
          {annual
            ? `Your next annual renewal on ${endDate} will be $0.99. After that, $29.99/yr unless canceled.`
            : `No charges until ${pauseEnd}. Your plan resumes automatically at $4.99/wk.`}
        </p>
        {quietLink("No thanks, cancel my plan", () => setView("confirm"))}
      </>,
    );
  }

  if (view === "confirm") {
    return shell(
      <>
        <h1 className="text-2xl font-bold">Your plan will end on {endDate}</h1>
        <p className="mt-2 text-sm text-brand-text-secondary">
          You'll keep full access until then.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={confirmCancel}
          className="mt-8 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          Cancel my subscription
        </button>
        {cancelFails >= 2 && (
          <button
            type="button"
            disabled={busy}
            onClick={fallbackPortalCancel}
            className="mt-4 w-full rounded-lg border border-brand-border px-8 py-4 text-sm font-semibold"
          >
            Cancel through our billing provider
          </button>
        )}
      </>,
    );
  }

  if (view === "saved") {
    return shell(
      <>
        <h1 className="text-2xl font-bold">
          {overview.plan === "annual"
            ? "You're all set: your next year is $0.99"
            : "Paused. Enjoy your 30 days on us."}
        </h1>
        <a href="/manage" className="mt-6 text-sm text-brand-text-secondary underline">
          Back to my subscription
        </a>
      </>,
    );
  }

  if (view === "kept") {
    return shell(
      <>
        <h1 className="text-2xl font-bold">Great choice</h1>
        <p className="mt-2 text-sm text-brand-text-secondary">
          Your plan continues unchanged.
        </p>
        <a href="/manage" className="mt-6 text-sm text-brand-text-secondary underline">
          Back to my subscription
        </a>
      </>,
    );
  }

  return shell(
    <>
      <h1 className="text-2xl font-bold">Canceled.</h1>
      <p className="mt-2 text-sm text-brand-text-secondary">
        You have access until {endDate}. Changed your mind? Resume anytime at
        video2pdf.ai/manage.
      </p>
    </>,
  );
}
