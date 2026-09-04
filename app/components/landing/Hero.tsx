"use client";

import { motion, type Variants } from "framer-motion";
import { Apple, Smartphone, ArrowRight } from "lucide-react";
import { TrackedLink } from "@/app/components/TrackedLink";
import { ProductDemo } from "./ProductDemo";
import { staggerContainer, staggerItem } from "./Reveal";

// The copy below the demo starts slightly after the headline group so the
// whole hero still reads as one staggered entrance.
const bottomStagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.24 },
  },
};

export function Hero() {
  return (
    <section className="bg-grid relative overflow-hidden pt-28 pb-16 sm:pt-32">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      {/* On phones the demo sits directly under the headline so it is in view
          on first land; on lg it moves to the right column spanning both text
          rows, restoring the side-by-side layout. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:grid lg:grid-cols-2 lg:items-center lg:gap-x-12">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="text-center lg:col-start-1 lg:row-start-1 lg:text-left"
        >
          <motion.div
            variants={staggerItem}
            className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground lg:mx-0"
          >
            <span className="size-1.5 rounded-full bg-primary-light" />
            Private by design, no account required
          </motion.div>

          {/* Plain h1 with a CSS entrance: the LCP element must be visible in
              server HTML instead of waiting for hydration like the motion nodes. */}
          <h1 className="hero-enter text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Film any book.{" "}
            <span className="bg-gradient-to-r from-primary via-primary-light to-primary-light bg-clip-text text-transparent">
              Get a searchable PDF.
            </span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="mt-6 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:mt-0"
        >
          <ProductDemo />
        </motion.div>

        <motion.div
          variants={bottomStagger}
          initial="hidden"
          animate="show"
          className="mt-6 text-center lg:col-start-1 lg:row-start-2 lg:mt-5 lg:text-left"
        >
          <motion.p
            variants={staggerItem}
            className="mx-auto max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground lg:mx-0"
          >
            Stop retyping your notes and scanning pages one at a time. Just press record, pan across
            the pages, and Video2PDF hands you a clean, searchable document in seconds.
          </motion.p>

          <motion.div
            variants={staggerItem}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start"
          >
            <TrackedLink
              href="/go"
              id="get-app-link"
              event="cta_start_trial_clicked"
              params={{ location: "hero" }}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/25 transition-colors hover:bg-primary-hover sm:w-auto"
            >
              Start Free Trial
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </TrackedLink>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Apple className="size-4" aria-hidden="true" />
              <Smartphone className="size-4" aria-hidden="true" />
              Free on iPhone and Android
            </div>
          </motion.div>

          <motion.p variants={staggerItem} className="mt-4 text-sm text-muted-foreground">
            Summer deal: lock in $29.99/year for life. 3 days free, cancel anytime before the trial
            ends and you won&apos;t be charged.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
