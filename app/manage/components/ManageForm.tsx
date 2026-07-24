"use client";

import { useState } from "react";

export function ManageForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok === false) {
        setError(
          data?.error === "No subscription found for that email"
            ? "We could not find a subscription for that email."
            : "Something went wrong. Please try again.",
        );
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text flex flex-col items-center px-6 pt-10 pb-10">
      <div className="w-full max-w-md flex flex-col items-center text-center">
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

        {error && (
          <p role="alert" className="mt-4 w-full text-center text-sm text-red-500">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={busy || !email}
          onClick={submit}
          className="mt-6 w-full rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          Manage subscription
        </button>
      </div>
    </main>
  );
}
