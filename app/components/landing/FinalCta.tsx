"use client";

import { ArrowRight } from "lucide-react";
import { TrackedLink } from "@/app/components/TrackedLink";
import { Reveal } from "./Reveal";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-bg-alt py-24">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Put the camera to work and never retype a page again
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty leading-relaxed text-muted-foreground">
            Try Video2PDF free for 3 days, then just $29.99 a year, locked in for life. Cancel
            anytime before the trial ends and you won&apos;t be charged.
          </p>
          <TrackedLink
            href="/go"
            event="cta_start_trial_clicked"
            params={{ location: "final_cta" }}
            className="group mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/25 transition-colors hover:bg-primary-hover"
          >
            Start Free Trial
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </TrackedLink>
          <p className="mt-4 text-sm text-muted-foreground">Free on iPhone and Android</p>
        </Reveal>
      </div>
    </section>
  );
}
