"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ScanLine, Hand, Frame, Wand2, Search, ShieldCheck } from "lucide-react";
import { Reveal } from "./Reveal";

const features = [
  {
    icon: ScanLine,
    title: "Smart Page Detection",
    body: "Knows the exact moment a page settles and grabs it, so you never miss a spread or capture a blurry flip.",
  },
  {
    icon: Hand,
    title: "Hand Avoidance",
    body: "Sees your fingers holding the book open and quietly skips those frames, keeping every page clean.",
  },
  {
    icon: Frame,
    title: "Perspective Correction",
    body: "Straightens pages shot at an angle into crisp, flat rectangles that look like a real scan.",
  },
  {
    icon: Wand2,
    title: "Adaptive Enhancement",
    body: "Balances shadows, glare, and lighting so faint text and yellowed paper come out sharp and readable.",
  },
  {
    icon: Search,
    title: "Searchable OCR Text",
    body: "Every word is recognized, so you can search, highlight, copy, and paste straight out of your PDF.",
  },
  {
    icon: ShieldCheck,
    title: "On-Device Privacy",
    body: "All processing happens on your phone. No account, no cloud, nothing ever leaves your device.",
  },
];

export function Features() {
  const reduce = useReducedMotion();

  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary-light">Features</p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Everything happens right on your phone
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.1}>
              <motion.div
                whileHover={reduce ? undefined : { y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group h-full rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
              >
                <span className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary-light transition-colors group-hover:bg-primary/25">
                  <f.icon className="size-5.5" aria-hidden="true" />
                </span>
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
