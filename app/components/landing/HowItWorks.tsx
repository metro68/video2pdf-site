"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Video, Sparkles, FileDown } from "lucide-react";
import { Reveal } from "./Reveal";

const steps = [
  {
    icon: Video,
    title: "Film the pages",
    body: "Open your book and slowly pan while you flip. One continuous video is all it takes, no tripod and no careful framing.",
  },
  {
    icon: Sparkles,
    title: "AI does the work",
    body: "On your phone, Video2PDF finds each settled page, dodges your fingers, picks the sharpest frame, and reads the text.",
  },
  {
    icon: FileDown,
    title: "Export your PDF",
    body: "Get a straightened, enhanced, fully searchable PDF you can copy, paste, and share. Done in seconds, not an afternoon.",
  },
];

export function HowItWorks() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 70%", "end 60%"],
  });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="how-it-works" className="relative py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary-light">How it works</p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Three steps from shelf to searchable
          </h2>
        </Reveal>

        <div ref={ref} className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-6">
          {/* connector line (desktop) */}
          <div className="absolute left-0 right-0 top-8 hidden h-0.5 bg-border md:block" aria-hidden="true">
            <motion.div
              className="h-full origin-left bg-gradient-to-r from-primary to-primary-light"
              style={{ scaleX: reduce ? 1 : lineScale }}
            />
          </div>

          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.12} className="relative text-center md:text-left">
              <div className="relative z-10 mb-5 inline-flex size-16 items-center justify-center rounded-2xl border border-border bg-card shadow-lg">
                <step.icon className="size-7 text-primary-light" aria-hidden="true" />
                <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
              </div>
              <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
              <p className="text-pretty leading-relaxed text-muted-foreground">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
