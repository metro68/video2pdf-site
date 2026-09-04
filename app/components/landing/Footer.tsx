"use client";

import Link from "next/link";
import { TrackedLink } from "@/app/components/TrackedLink";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/seo/jsonld";

export function Footer() {
  return (
    // Extra bottom padding on phones keeps the links clear of the sticky CTA bar.
    <footer className="border-t border-border bg-background pt-12 pb-28 md:pb-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/assets/icon-192.png"
            alt="Video2PDF logo"
            width={32}
            height={32}
            className="size-8 rounded-lg object-cover"
          />
          <span className="text-lg font-bold tracking-tight text-foreground">
            Video<span className="text-primary-light">2</span>PDF
          </span>
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <a href="/how-to-scan-a-book" className="transition-colors hover:text-foreground">
            How to Scan a Book
          </a>
          <a href="/about" className="transition-colors hover:text-foreground">
            About
          </a>
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

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Download on the App Store
          </a>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Get it on Google Play
          </a>
        </nav>

        <p className="text-xs text-muted-foreground">
          © 2026 Kaelor Ltd. Video2PDF is made by Kaelor Ltd. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
