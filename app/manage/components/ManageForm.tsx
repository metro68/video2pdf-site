"use client";

import { useState } from "react";
import type { ManageOverview } from "@/lib/manage/overview";

const PLAN_NAMES = { weekly: "Weekly", annual: "Annual" } as const;

export function fmtDate(ms: number | null): string {
  if (ms == null) return "your renewal date";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ManageForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<ManageOverview | null>(null);
  const [resumed, setResumed] = useState(false);

  async function post(path: string, body: unknown): Promise<Response> {
    return fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function lookup() {
    setError(null);
    setBusy(true);
    try {
      const res = await post("/api/manage/lookup", { email });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        setError(
          data?.error === "No subscription found for that email"
            ? "We could not find a subscription for that email."
            : "Something went wrong. Please try again.",
        );
        return;
      }
      setToken(data.token);
      setOverview(data.overview);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await post("/api/manage/portal", { token });
      const data = await res.json().catch(() => ({}));
      if (data?.url) window.location.assign(data.url);
      else setError("Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await post("/api/manage/resume", { token });
      if (res.ok) setResumed(true);
      else setError("Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function startCancelFlow() {
    if (!token || !overview) return;
    sessionStorage.setItem("v2p_manage", JSON.stringify({ token, overview }));
    window.location.assign("/manage/cancel");
  }

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-brand-bg text-brand-text flex flex-col items-center px-6 pt-10 pb-10">
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

  if (overview && token) {
    if (resumed) {
      return shell(
        <>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-brand-text-secondary">
            Your plan is active again and renews on {fmtDate(overview.currentPeriodEnd)}.
          </p>
        </>,
      );
    }
    return shell(
      <>
        <h1 className="text-2xl font-bold">Your subscription</h1>
        <div className="mt-6 w-full rounded-lg border border-brand-border bg-brand-bg-card p-5 text-left">
          <p className="font-semibold">
            {PLAN_NAMES[overview.plan]} plan, {overview.priceLabel}
          </p>
          <p className="mt-1 text-sm text-brand-text-secondary">
            {overview.cancelAtPeriodEnd
              ? `Your plan ends on ${fmtDate(overview.currentPeriodEnd)}.`
              : overview.pastDue
                ? "Your last payment failed. Update your payment method to keep access."
                : `Renews on ${fmtDate(overview.currentPeriodEnd)}.`}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={openPortal}
          className="mt-6 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          Update payment method
        </button>
        {overview.cancelAtPeriodEnd ? (
          <button
            type="button"
            disabled={busy}
            onClick={resume}
            className="mt-3 w-full rounded-lg border border-brand-border px-8 py-4 text-base font-semibold disabled:opacity-40"
          >
            Resume subscription
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={startCancelFlow}
            className="mt-4 text-sm text-brand-text-secondary underline"
          >
            Cancel subscription
          </button>
        )}
      </>,
    );
  }

  return shell(
    <>
      <h1 className="text-2xl font-bold">Manage your subscription</h1>
      <p className="mt-2 text-sm text-brand-text-secondary">
        Enter the email you subscribed with to manage or cancel your plan.
      </p>
      <label htmlFor="manage-email" className="sr-only">
        Your email
      </label>
      <input
        id="manage-email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-6 w-full rounded-lg border border-brand-border bg-brand-bg-card px-4 py-4 text-brand-text"
      />
      <button
        type="button"
        disabled={busy || !email}
        onClick={lookup}
        className="mt-6 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
      >
        Find my subscription
      </button>
    </>,
  );
}
