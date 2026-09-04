"use client";

import { motion, useReducedMotion } from "framer-motion";
import { WifiOff, UserX, Lock } from "lucide-react";
import { Reveal } from "./Reveal";

const points = [
  { icon: WifiOff, label: "Full-resolution scans never leave your phone" },
  { icon: UserX, label: "No account and no sign-up required" },
  { icon: Lock, label: "Page-detection frames are deleted after processing" },
];

export function BindySection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative bg-bg-alt py-24">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 sm:px-6 md:grid-cols-2">
        <Reveal className="order-2 md:order-1">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary-light">Meet Bindy</p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Your bookworm reads along, privately
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Bindy is the friendly bookworm powering Video2PDF. Your video, page images, and
            finished PDFs stay on your phone: cleanup, enhancement, and text recognition all run
            on-device. Only reduced-resolution copies of sampled frames go to our servers to find
            and order your pages, and they're deleted right after. No accounts, ever.
          </p>

          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p.label} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-light">
                  <p.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-sm text-foreground">{p.label}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="order-1 flex justify-center md:order-2">
          <div className="relative">
            <div className="pointer-events-none absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-3xl" />
            <motion.div
              animate={reduce ? undefined : { y: [0, -14, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <img
                src="/assets/bindy.png"
                alt="Bindy, the friendly Video2PDF bookworm mascot, reading an open book"
                width={300}
                height={300}
                loading="lazy"
                className="relative w-56 max-w-full drop-shadow-2xl sm:w-[300px]"
              />
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
