"use client";

import { motion } from "framer-motion";
import { Apple, Smartphone, ArrowRight } from "lucide-react";
import { TrackedLink } from "@/app/components/TrackedLink";
import { ProductDemo } from "./ProductDemo";
import { staggerContainer, staggerItem } from "./Reveal";

export function Hero() {
  return (
    <section className="bg-grid relative overflow-hidden pt-28 pb-16 sm:pt-32">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="text-center lg:text-left">
          <motion.div
            variants={staggerItem}
            className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground lg:mx-0"
          >
            <span className="size-1.5 rounded-full bg-primary-light" />
            On-device AI, nothing uploaded
          </motion.div>

          <motion.h1
            variants={staggerItem}
            className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Film any book.{" "}
            <span className="bg-gradient-to-r from-primary via-primary-light to-primary-light bg-clip-text text-transparent">
              Get a searchable PDF.
            </span>
          </motion.h1>

          <motion.p
            variants={staggerItem}
            className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground lg:mx-0"
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

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <ProductDemo />
        </motion.div>
      </div>
    </section>
  );
}
