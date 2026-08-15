"use client";

import { useInView, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal";

const testimonials = [
  {
    quote:
      "I filmed a whole chapter in one pass on the bus and had a searchable PDF before my stop. It saved me an entire evening of retyping.",
    name: "Maya R.",
    role: "Biology student",
  },
  {
    quote:
      "The perspective correction is uncanny. Pages I shot at an angle come out perfectly flat, and the OCR actually finds my terms.",
    name: "Dr. Alan Whitfield",
    role: "Research fellow",
  },
  {
    quote:
      "I capture worksheets for my class in seconds now. Knowing nothing leaves my phone made it an easy yes for our school.",
    name: "Priya S.",
    role: "High school teacher",
  },
];

function Counter({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    // All state updates happen inside animation frames so the effect itself
    // never sets state synchronously.
    const duration = reduce ? 0 : 1800;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.floor(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, reduce]);

  return <span ref={ref}>{value.toLocaleString("en-US")}</span>;
}

export function SocialProof() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="flex flex-col items-center text-center">
          <div className="mb-3 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="size-5 fill-primary-light text-primary-light"
                aria-hidden="true"
              />
            ))}
          </div>
          <p className="text-lg font-semibold">
            Rated 5 stars on the App Store
          </p>
          <p className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-primary-light to-primary bg-clip-text text-transparent">
              <Counter target={1000000} />
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            pages scanned and counting
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <figure className="h-full rounded-2xl border border-border bg-card p-6">
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star
                      key={k}
                      className="size-4 fill-primary-light text-primary-light"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <blockquote className="text-pretty text-sm leading-relaxed text-foreground">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold text-foreground">
                    {t.name}
                  </span>
                  <span className="text-muted-foreground">, {t.role}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
