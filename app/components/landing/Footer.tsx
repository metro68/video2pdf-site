"use client";

import Link from "next/link";
import { TrackedLink } from "@/app/components/TrackedLink";

export function Footer() {
  return (
    // Extra bottom padding on phones keeps the links clear of the sticky CTA bar.
    <footer className="border-t border-border bg-background pt-12 pb-28 md:pb-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/assets/icon.png"
            alt="Video2PDF logo"
            className="size-8 rounded-lg object-cover"
          />
          <span className="text-lg font-bold tracking-tight text-foreground">
            Video<span className="text-primary-light">2</span>PDF
          </span>
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <TrackedLink
            href="/manage"
            event="cta_manage_clicked"
            params={{ location: "footer" }}
            className="transition-colors hover:text-foreground"
          >
            Manage Subscription
          </TrackedLink>
          <a href="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </a>
          <a href="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </a>
          <a href="/delete-account" className="transition-colors hover:text-foreground">
            Delete Your Data
          </a>
          <a href="mailto:support@video2pdf.ai" className="transition-colors hover:text-foreground">
            Support
          </a>
        </nav>

        <p className="text-xs text-muted-foreground">© 2026 Video2PDF. All rights reserved.</p>
      </div>
    </footer>
  );
}
