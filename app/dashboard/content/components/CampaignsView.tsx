"use client";

import { useEffect, useState } from "react";
import type { Campaign, Concept } from "@/lib/content/types";

interface CampaignsResponse {
  status: "ok" | "error";
  data: { campaigns: Campaign[] } | null;
  error?: string;
}
interface ConceptsResponse {
  status: "ok" | "error";
  data: { concepts: Concept[] } | null;
  error?: string;
}

const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

export default function CampaignsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/content/campaigns").then((r) => r.json() as Promise<CampaignsResponse>),
      fetch("/api/content/concepts").then((r) => r.json() as Promise<ConceptsResponse>),
    ])
      .then(([c, k]) => {
        if (cancelled) return;
        if (c.status === "ok" && c.data) setCampaigns(c.data.campaigns);
        else setError(c.error ?? "Could not load campaigns.");
        if (k.status === "ok" && k.data) setConcepts(k.data.concepts);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load campaigns.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const reload = () => setReloadTick((t) => t + 1);

  if (loading && campaigns.length === 0) {
    return <p className="text-sm text-brand-text-secondary">Loading campaigns&hellip;</p>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Campaigns</h2>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="rounded-lg border border-brand-border px-3 py-1.5 text-sm hover:bg-brand-bg-card"
          >
            {creating ? "Cancel" : "New campaign"}
          </button>
        </div>

        {creating ? <NewCampaignForm onCreated={() => { setCreating(false); reload(); }} /> : null}

        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-brand-bg-card p-6">
            <p className="text-sm text-brand-text-secondary">
              No campaigns yet. A campaign holds the objective, destination and the
              spend cap that generation runs against.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-brand-bg-card text-left text-brand-text-secondary">
                <tr>
                  <th className="px-4 py-2 font-medium">Campaign</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Quality</th>
                  <th className="px-4 py-2 text-right font-medium">Spent</th>
                  <th className="px-4 py-2 text-right font-medium">Budget</th>
                  <th className="px-4 py-2 font-medium">Destination</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const overBudget =
                    c.imageBudgetCents != null && c.spentCents >= c.imageBudgetCents;
                  return (
                    <tr key={c.id} className="border-t border-brand-border">
                      <td className="px-4 py-2">
                        <span className="font-medium">{c.name}</span>
                        {c.objective ? (
                          <div className="text-xs text-brand-text-secondary">{c.objective}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-brand-text-secondary">{c.status}</td>
                      <td className="px-4 py-2 text-brand-text-secondary">{c.imageQuality}</td>
                      <td
                        className={`px-4 py-2 text-right ${overBudget ? "text-red-500" : ""}`}
                      >
                        {money(c.spentCents)}
                      </td>
                      <td className="px-4 py-2 text-right text-brand-text-secondary">
                        {c.imageBudgetCents == null ? "uncapped" : money(c.imageBudgetCents)}
                      </td>
                      <td className="px-4 py-2 text-xs text-brand-text-secondary">
                        {c.destinationPath}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Concepts</h2>
        <p className="text-sm text-brand-text-secondary">
          A concept is the reusable half of a creative: the hook and angle. The same
          concept can run on several accounts, but each account gets its own
          generated media, never a copy of another account&apos;s file.
        </p>
        {concepts.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-brand-bg-card p-6">
            <p className="text-sm text-brand-text-secondary">
              No concepts yet. Save one from an outlier in Trends, or add one directly
              once a campaign exists.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {concepts.map((k) => (
              <li
                key={k.id}
                className="rounded-lg border border-brand-border bg-brand-bg-card p-3"
              >
                <div className="text-sm font-medium">{k.hook}</div>
                <div className="mt-1 text-xs text-brand-text-secondary">
                  {k.format}
                  {k.angle ? ` · ${k.angle}` : ""}
                  {k.sourcePostId ? " · from a tracked outlier" : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NewCampaignForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [imageQuality, setImageQuality] = useState("low");
  const [budgetDollars, setBudgetDollars] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === "") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/content/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, objective, utmCampaign, imageQuality, budgetDollars }),
      });
      const json = (await res.json()) as { status: string; error?: string };
      if (json.status !== "ok") {
        setError(json.error ?? "Could not create campaign.");
        return;
      }
      onCreated();
    } catch {
      setError("Could not create campaign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-brand-border bg-brand-bg-card p-3"
    >
      <label className="flex flex-col text-xs text-brand-text-secondary">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-0.5 w-44 rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm text-brand-text"
        />
      </label>
      <label className="flex flex-col text-xs text-brand-text-secondary">
        Objective
        <input
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          className="mt-0.5 w-52 rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm text-brand-text"
        />
      </label>
      <label className="flex flex-col text-xs text-brand-text-secondary">
        utm_campaign
        <input
          value={utmCampaign}
          onChange={(e) => setUtmCampaign(e.target.value)}
          className="mt-0.5 w-36 rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm text-brand-text"
        />
      </label>
      <label className="flex flex-col text-xs text-brand-text-secondary">
        Image quality
        <select
          value={imageQuality}
          onChange={(e) => setImageQuality(e.target.value)}
          className="mt-0.5 rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm text-brand-text"
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </label>
      <label className="flex flex-col text-xs text-brand-text-secondary">
        Budget ($, blank = uncapped)
        <input
          value={budgetDollars}
          onChange={(e) => setBudgetDollars(e.target.value)}
          inputMode="decimal"
          className="mt-0.5 w-36 rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-sm text-brand-text"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-brand-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Creating" : "Create"}
      </button>
      {error ? <span className="text-sm text-red-500">{error}</span> : null}
    </form>
  );
}
