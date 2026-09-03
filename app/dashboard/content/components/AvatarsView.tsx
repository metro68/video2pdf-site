"use client";

import { useEffect, useRef, useState } from "react";
import type { Avatar } from "@/lib/db/content/avatars";

interface AvatarsResponse {
  status: "ok" | "error";
  data: { avatars: Avatar[] } | null;
  error?: string;
}

export default function AvatarsView() {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/content/avatars")
      .then((r) => r.json() as Promise<AvatarsResponse>)
      .then((res) => {
        if (cancelled) return;
        if (res.status === "ok" && res.data) setAvatars(res.data.avatars);
        else setError(res.error ?? "Could not load avatars.");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load avatars.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === "") return;
    setBusy(true);
    try {
      await fetch("/api/content/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setName("");
      setReloadTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  if (loading && avatars.length === 0) {
    return <p className="text-sm text-brand-text-secondary">Loading avatars&hellip;</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-border bg-brand-bg-card p-4">
        <p className="text-sm text-brand-text-secondary">
          Reference photos keep a recurring character recognisable across generated
          scenes: mirror selfies, desk shots, product holds. v1 produces stills
          only, no talking-head and no lip sync. Upload photos you have the right
          to use.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : null}

      <form onSubmit={create} className="flex items-end gap-2">
        <label className="flex flex-col text-xs text-brand-text-secondary">
          New avatar name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-0.5 w-52 rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm text-brand-text"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Create
        </button>
      </form>

      {avatars.length === 0 ? (
        <div className="rounded-xl border border-brand-border bg-brand-bg-card p-6">
          <p className="text-sm text-brand-text-secondary">
            No avatars yet. Create one, then upload two or three reference photos.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {avatars.map((a) => (
            <AvatarRow key={a.id} avatar={a} onChanged={() => setReloadTick((t) => t + 1)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AvatarRow({ avatar, onChanged }: { avatar: Avatar; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("avatarId", String(avatar.id));
      form.append("index", String(avatar.referenceKeys.length));
      form.append("file", file);
      const res = await fetch("/api/content/avatars", { method: "POST", body: form });
      const json = (await res.json()) as { status: string; error?: string };
      if (json.status !== "ok") setError(json.error ?? "Upload failed.");
      else onChanged();
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <li className="rounded-xl border border-brand-border bg-brand-bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{avatar.name}</span>
          <div className="text-xs text-brand-text-secondary">
            {avatar.referenceKeys.length} reference photo(s)
            {avatar.referenceKeys.length < 2 ? " · add at least 2 for consistency" : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={upload}
            disabled={busy}
            aria-label={`Upload reference photo for ${avatar.name}`}
            className="text-xs"
          />
          <button
            type="button"
            onClick={async () => {
              await fetch(`/api/content/avatars?id=${avatar.id}`, { method: "DELETE" });
              onChanged();
            }}
            className="rounded-md border border-brand-border px-2 py-1 text-xs hover:bg-brand-bg"
          >
            Delete
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
    </li>
  );
}
