"use client";

import { useState } from "react";
import DashboardTabs from "@/app/dashboard/components/DashboardTabs";
import TrendsView from "./TrendsView";
import CampaignsView from "./CampaignsView";

// The content engine's six views live inside the Content tab rather than as
// six more top-level dashboard tabs, so the dashboard's own tab strip stays
// readable. Views ship progressively: anything not yet built states so plainly
// instead of rendering an empty shell.
const VIEWS = [
  { key: "trends", label: "Trends" },
  { key: "campaigns", label: "Campaigns" },
  { key: "avatars", label: "Avatars" },
  { key: "review", label: "Review" },
  { key: "calendar", label: "Calendar" },
  { key: "results", label: "Results" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

export default function ContentClient() {
  const [view, setView] = useState<ViewKey>("trends");

  return (
    <main className="min-h-screen bg-brand-bg p-6 text-brand-text">
      <div className="mx-auto max-w-6xl space-y-6">
        <DashboardTabs />

        <div>
          <h1 className="text-xl font-semibold">Content engine</h1>
          <p className="mt-1 text-sm text-brand-text-secondary">
            Research what is working, generate faceless Reels and carousels, approve
            every post before it publishes, then compare results with the funnel.
          </p>
        </div>

        <nav
          aria-label="Content views"
          className="flex w-fit flex-wrap items-center gap-1 rounded-lg border border-brand-border bg-brand-bg-card p-1"
        >
          {VIEWS.map((v) => {
            const active = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-primary text-white"
                    : "text-brand-text-secondary hover:bg-brand-bg hover:text-brand-text"
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </nav>

        {view === "trends" ? <TrendsView /> : null}
        {view === "campaigns" ? <CampaignsView /> : null}
        {view !== "trends" && view !== "campaigns" ? (
          <ComingSoon label={viewLabel(view)} />
        ) : null}
      </div>
    </main>
  );
}

function viewLabel(key: ViewKey): string {
  return VIEWS.find((v) => v.key === key)?.label ?? key;
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-bg-card p-6">
      <p className="text-sm text-brand-text-secondary">
        {label} is not built yet. Trends is the first view: add accounts to the
        watchlist and record what they are posting, and the ranking below will
        show which posts are outperforming their own account baseline.
      </p>
    </div>
  );
}
