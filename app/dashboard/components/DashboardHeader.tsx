"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import DashboardTabs from "./DashboardTabs";

// Shared chrome for every dashboard view: identity, sign out, and the tab strip.
//
// This used to live inside DashboardClient, which meant sign out vanished as
// soon as you switched to Ads eval or Content. Anything view-specific (the
// Overview month picker) is passed in as `actions` and sits beside sign out.
export default function DashboardHeader({
  subtitle,
  actions,
}: {
  subtitle?: string;
  actions?: ReactNode;
}) {
  const router = useRouter();

  async function onSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/assets/icon.png" alt="Video2PDF" className="h-10 w-10 rounded-lg" />
          <div>
            <h1 className="text-xl font-bold text-brand-primary">Video2PDF Analytics</h1>
            {subtitle ? (
              <p className="text-xs text-brand-text-secondary">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {actions}
          <button
            onClick={onSignOut}
            className="text-sm text-brand-text-secondary underline"
          >
            Sign out
          </button>
        </div>
      </header>

      <DashboardTabs />
    </>
  );
}
