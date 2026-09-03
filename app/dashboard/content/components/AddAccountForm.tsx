"use client";

import { useState } from "react";
import type { AccountKind, Platform } from "@/lib/content/types";

// Adds an owned or watched account to the watchlist. Owned accounts are the
// ones we publish to; watched accounts are public handles used for research
// only and are never a publish target.
export default function AddAccountForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [kind, setKind] = useState<AccountKind>("watched");
  const [angle, setAngle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (handle.trim() === "") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/content/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, kind, handle, angle: angle || null }),
      });
      const json = (await res.json()) as { status: string; error?: string };
      if (json.status !== "ok") {
        setError(json.error ?? "Could not add account.");
        return;
      }
      setHandle("");
      setAngle("");
      setOpen(false);
      onAdded();
    } catch {
      setError("Could not add account.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-brand-border px-3 py-1.5 text-sm hover:bg-brand-bg-card"
      >
        Add account
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-border bg-brand-bg-card p-2"
    >
      <input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="@handle"
        aria-label="Account handle"
        className="w-36 rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm"
      />
      <select
        value={platform}
        onChange={(e) => setPlatform(e.target.value as Platform)}
        aria-label="Platform"
        className="rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm"
      >
        <option value="instagram">Instagram</option>
        <option value="tiktok">TikTok</option>
      </select>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as AccountKind)}
        aria-label="Account type"
        className="rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm"
      >
        <option value="watched">Watched</option>
        <option value="owned">Owned</option>
      </select>
      <input
        value={angle}
        onChange={(e) => setAngle(e.target.value)}
        placeholder="angle (optional)"
        aria-label="Account angle"
        className="w-40 rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-brand-primary px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Adding" : "Add"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md border border-brand-border px-3 py-1 text-sm"
      >
        Cancel
      </button>
      {error ? <span className="text-sm text-red-500">{error}</span> : null}
    </form>
  );
}
