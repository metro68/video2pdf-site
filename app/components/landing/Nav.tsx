"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrackedLink } from "@/app/components/TrackedLink";
import { trackCustom } from "@/lib/pixel/events";

const links = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || open
          ? "border-b border-border/70 bg-background/70 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <TrackedLink
        href="/go"
        event="cta_start_trial_clicked"
        params={{ location: "deal_banner" }}
        className="block bg-primary px-4 py-2 text-center text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover sm:text-sm"
      >
        Summer deal: lock in $29.99/year for life · 3 days free · Claim it →
      </TrackedLink>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/assets/icon-192.png"
            alt="Video2PDF logo"
            width={32}
            height={32}
            className="size-8 rounded-lg object-cover shadow-md shadow-black/30"
          />
          <span className="text-lg font-bold tracking-tight text-foreground">
            Video<span className="text-primary-light">2</span>PDF
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/manage"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Manage
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <TrackedLink
            href="/go"
            event="cta_start_trial_clicked"
            params={{ location: "nav" }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary-hover"
          >
            Start Free Trial
          </TrackedLink>

          <button
            type="button"
            className="flex size-10 flex-col items-center justify-center gap-1.5 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span
              className={`h-0.5 w-5 rounded-full bg-foreground transition-transform ${
                open ? "translate-y-1 rotate-45" : ""
              }`}
            />
            <span
              className={`h-0.5 w-5 rounded-full bg-foreground transition-transform ${
                open ? "-translate-y-1 -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur-xl md:hidden" role="menu">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/manage"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground"
              onClick={() => {
                trackCustom("cta_manage_clicked", { location: "mobile_menu" });
                setOpen(false);
              }}
            >
              Manage Subscription
            </Link>
            <Link
              href="/go"
              className="mt-2 rounded-full bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
              onClick={() => {
                trackCustom("cta_start_trial_clicked", { location: "mobile_menu" });
                setOpen(false);
              }}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
