"use client";

import { useState } from "react";
import type { PostSnapshot } from "@/lib/content/types";

// Turns a tracked outlier into a reusable concept. The post's caption seeds the
// hook so an operator edits rather than retypes, and source_post_id records
// which observed post the idea came from, so Results can later ask whether
// concepts drawn from outliers actually outperform.
export default function SaveConceptButton({ post }: { post: PostSnapshot }) {
  const [open, setOpen] = useState(false);
  const [hook, setHook] = useState(post.caption?.slice(0, 120) ?? "");
  const [angle, setAngle] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hook.trim() === "") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/content/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook,
          angle: angle || null,
          sourcePostId: post.id,
          format: post.mediaType === "carousel" ? "carousel" : "reel",
        }),
      });
      const json = (await res.json()) as { status: string; error?: string };
      if (json.status !== "ok") {
        setError(json.error ?? "Could not save concept.");
        return;
      }
      setSaved(true);
      setOpen(false);
    } catch {
      setError("Could not save concept.");
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return <span className="text-xs text-brand-text-secondary">Saved</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-brand-border px-2 py-1 text-xs hover:bg-brand-bg-card"
      >
        Save concept
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1 text-left">
      <input
        value={hook}
        onChange={(e) => setHook(e.target.value)}
        placeholder="hook"
        aria-label="Concept hook"
        className="w-52 rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-xs"
      />
      <input
        value={angle}
        onChange={(e) => setAngle(e.target.value)}
        placeholder="angle (optional)"
        aria-label="Concept angle"
        className="w-52 rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-xs"
      />
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand-primary px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          {busy ? "Saving" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-brand-border px-2 py-1 text-xs"
        >
          Cancel
        </button>
      </div>
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
    </form>
  );
}
