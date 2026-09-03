"use client";

import { useState } from "react";
import type { SocialAccount } from "@/lib/content/types";

// Records one operator-entered reading: either the account's profile figures
// or a single post's public numbers. Fields a platform does not show publicly
// are left blank and stored as null, never as zero, so a missing figure is
// never mistaken for a measured one.
export default function RecordReadingForm({
  account,
  onRecorded,
}: {
  account: SocialAccount;
  onRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"profile" | "post">("post");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [followers, setFollowers] = useState("");
  const [postCount, setPostCount] = useState("");

  const [postUrl, setPostUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [shares, setShares] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body =
      mode === "profile"
        ? { type: "profile", accountId: account.id, followers, postCount }
        : {
            type: "post",
            accountId: account.id,
            postUrl,
            caption,
            publishedAt: publishedAt || undefined,
            views,
            likes,
            comments,
            shares,
          };
    try {
      const res = await fetch("/api/content/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { status: string; error?: string };
      if (json.status !== "ok") {
        setError(json.error ?? "Could not record reading.");
        return;
      }
      setPostUrl("");
      setCaption("");
      setViews("");
      setLikes("");
      setComments("");
      setShares("");
      setOpen(false);
      onRecorded();
    } catch {
      setError("Could not record reading.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-brand-border px-2 py-1 text-xs hover:bg-brand-bg-card"
      >
        Record
      </button>
    );
  }

  const numField = (
    label: string,
    value: string,
    set: (v: string) => void,
    hint?: string,
  ) => (
    <label className="flex flex-col text-xs text-brand-text-secondary">
      {label}
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        inputMode="numeric"
        placeholder={hint ?? ""}
        className="mt-0.5 w-24 rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm text-brand-text"
      />
    </label>
  );

  return (
    <form
      onSubmit={submit}
      className="mt-2 flex flex-col gap-2 rounded-lg border border-brand-border bg-brand-bg-card p-3 text-left"
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("post")}
          className={`rounded-md px-2 py-1 text-xs ${mode === "post" ? "bg-brand-primary text-white" : "border border-brand-border"}`}
        >
          Post
        </button>
        <button
          type="button"
          onClick={() => setMode("profile")}
          className={`rounded-md px-2 py-1 text-xs ${mode === "profile" ? "bg-brand-primary text-white" : "border border-brand-border"}`}
        >
          Profile
        </button>
      </div>

      {mode === "profile" ? (
        <div className="flex flex-wrap gap-2">
          {numField("Followers", followers, setFollowers)}
          {numField("Posts", postCount, setPostCount)}
        </div>
      ) : (
        <>
          <input
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="post URL"
            aria-label="Post URL"
            className="rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm"
          />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="caption or hook"
            aria-label="Caption"
            className="rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm"
          />
          <label className="flex flex-col text-xs text-brand-text-secondary">
            Published
            <input
              type="date"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="mt-0.5 rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm text-brand-text"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {numField("Views", views, setViews, account.platform === "instagram" ? "often n/a" : "")}
            {numField("Likes", likes, setLikes)}
            {numField("Comments", comments, setComments)}
            {numField("Shares", shares, setShares, "if shown")}
          </div>
          <p className="text-xs text-brand-text-secondary">
            Leave a field blank when the platform does not show it. Blank is stored as
            &ldquo;not available&rdquo;, which is different from zero.
          </p>
        </>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand-primary px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Saving" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-brand-border px-3 py-1 text-sm"
        >
          Cancel
        </button>
        {error ? <span className="text-xs text-red-500">{error}</span> : null}
      </div>
    </form>
  );
}
