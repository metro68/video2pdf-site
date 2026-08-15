"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { TrackedLink } from "@/app/components/TrackedLink";
import { Reveal } from "./Reveal";

const perks = [
  "Unlimited scans, every book and handout",
  "Full-resolution, straightened pages",
  "Searchable, copy-pasteable text",
  "No watermarks, ever",
  "On-device processing, fully private",
];

export function Pricing() {
  const reduce = useReducedMotion();

  return (
    <section id="pricing" className="relative py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary-light">Pricing</p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Summer deal: lock in your price for life
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Subscribe this summer and $29.99/year is your price forever. It never increases on you,
            even as we add features.
          </p>
        </Reveal>

        <Reveal className="mx-auto mt-12 max-w-md">
          <div className="relative">
            {/* animated glow border */}
            {!reduce && (
              <motion.div
                className="absolute -inset-px rounded-3xl bg-gradient-to-r from-primary via-accent to-primary-light opacity-60 blur"
                animate={{ opacity: [0.35, 0.7, 0.35] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden="true"
              />
            )}

            <div className="relative rounded-3xl border border-border bg-card p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Video2PDF Pro</h3>
                  <p className="text-sm text-muted-foreground">Everything, unlimited</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-primary-light">
                  <Lock className="size-3" aria-hidden="true" />
                  Price locked for life
                </span>
              </div>

              <div className="mb-2 flex items-end gap-1">
                <span className="text-5xl font-extrabold tracking-tight">$29.99</span>
                <span className="mb-1.5 text-muted-foreground">/year</span>
              </div>
              <p className="mb-6 text-sm font-medium text-primary-light">Starts with a 3-day free trial</p>

              <ul className="mb-8 space-y-3">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary-light">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                    <span className="text-foreground">{perk}</span>
                  </li>
                ))}
              </ul>

              <TrackedLink
                href="/go"
                event="cta_start_trial_clicked"
                params={{ location: "pricing" }}
                className="block w-full rounded-full bg-primary py-3.5 text-center text-base font-semibold text-primary-foreground shadow-xl shadow-primary/25 transition-colors hover:bg-primary-hover"
              >
                Start Your Free Trial
              </TrackedLink>
              <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
                Cancel anytime before your 3-day trial ends and you won&apos;t be charged. After the
                trial, it&apos;s $29.99 per year at the price you locked in.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
