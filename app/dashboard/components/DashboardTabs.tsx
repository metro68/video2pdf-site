"use client";

import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Overview", adminOnly: false },
  { href: "/dashboard/ads", label: "Ads eval", adminOnly: true },
] as const;

// Segmented view switcher shown on every dashboard page, so Overview and
// Ads eval read as two views of one dashboard rather than separate pages.
export default function DashboardTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Dashboard views"
      className="flex w-fit items-center gap-1 rounded-lg border border-brand-border bg-brand-bg-card p-1"
    >
      {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => {
        const active = pathname === t.href;
        return (
          <a
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-primary text-white"
                : "text-brand-text-secondary hover:bg-brand-bg hover:text-brand-text"
            }`}
          >
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}
